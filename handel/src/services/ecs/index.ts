/*
 * Copyright 2018 Brigham Young University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import {
    DeployContext,
    DeployOutputType,
    PreDeployContext,
    ServiceConfig,
    ServiceContext,
    ServiceDeployer,
    UnDeployContext,
    UnPreDeployContext
} from 'handel-extension-api';
import {
    checkPhase,
    deletePhases,
    deployPhase,
    handlebars,
    preDeployPhase,
    tagging
} from 'handel-extension-support';
import * as winston from 'winston';
import * as ec2Calls from '../../aws/ec2-calls';
import * as route53 from '../../aws/route53-calls';
import * as containersSection from '../../common/ecs-containers';
import * as routingSection from '../../common/ecs-routing';
import * as serviceAutoScalingSection from '../../common/ecs-service-auto-scaling';
import * as volumesSection from '../../common/ecs-volumes';
import * as asgCycling from './asg-cycling';
import * as cluster from './cluster';
import * as clusterAutoScalingSection from './cluster-auto-scaling';
import {EcsServiceConfig, HandlebarsEcsTemplateConfig} from './config-types';

const SERVICE_NAME = 'ECS';
const DEFAULT_INSTANCE_TYPE = 't2.micro';

function getTaskRoleStatements(serviceContext: ServiceContext<EcsServiceConfig>, dependenciesDeployContexts: DeployContext[]) {
    return deployPhase.getAllPolicyStatementsForServiceRole(serviceContext, [], dependenciesDeployContexts, true, true);
}

function getLatestEcsAmiId() {
    return ec2Calls.getLatestAmiByName('amazon', 'amazon-ecs');
}

async function getCompiledEcsTemplate(stackName: string, clusterName: string, ownServiceContext: ServiceContext<EcsServiceConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[], userDataScript: string) {
    const accountConfig = ownServiceContext.accountConfig;

    const results = await Promise.all([getLatestEcsAmiId(), route53.listHostedZones()]);
    const [latestEcsAmi, hostedZones] = results;
    const serviceParams = ownServiceContext.params;
    let instanceType = DEFAULT_INSTANCE_TYPE;
    if (serviceParams.cluster && serviceParams.cluster.instance_type) {
        instanceType = serviceParams.cluster.instance_type;
    }

    // Configure auto-scaling
    const autoScaling = serviceAutoScalingSection.getTemplateAutoScalingConfig(ownServiceContext, clusterName);

    // Configure containers in the task definition
    const containerConfigs = await containersSection.getContainersConfig(ownServiceContext, dependenciesDeployContexts, clusterName);
    const oneOrMoreTasksHasRouting = routingSection.oneOrMoreTasksHasRouting(ownServiceContext);

    const executionPolicyStatements = containersSection.getExecutionRuleSecretStatements(ownServiceContext, containerConfigs);

    const logRetention = ownServiceContext.params.log_retention_in_days;

    const serviceRoleName = `${stackName}-service-role`;
    const instanceMemory = await clusterAutoScalingSection.getMemoryForInstanceType(ownServiceContext);
    // Create object used for templating the CloudFormation template
    const handlebarsParams: HandlebarsEcsTemplateConfig = {
        clusterName,
        stackName,
        instanceType,
        minInstances: await clusterAutoScalingSection.getInstanceCountForCluster(instanceMemory, autoScaling, containerConfigs, 'min', SERVICE_NAME),
        maxInstances: await clusterAutoScalingSection.getInstanceCountForCluster(instanceMemory, autoScaling, containerConfigs, 'max', SERVICE_NAME),
        ecsSecurityGroupId: ownPreDeployContext.securityGroups[0].GroupId!,
        amiImageId: latestEcsAmi!.ImageId!,
        userData: new Buffer(userDataScript).toString('base64'),
        privateSubnetIds: accountConfig.private_subnets,
        publicSubnetIds: accountConfig.public_subnets,
        asgCooldown: '60', // This is set pretty short because we handel the instance-level auto-scaling from a Lambda that runs every minute.
        minimumHealthyPercentDeployment: '50', // TODO - Do we need to support more than just 50?
        vpcId: accountConfig.vpc,
        serviceRoleName,
        policyStatements: getTaskRoleStatements(ownServiceContext, dependenciesDeployContexts),
        executionPolicyStatements,
        deploymentSuffix: Math.floor(Math.random() * 10000), // ECS won't update unless something in the service changes.
        tags: tagging.getTags(ownServiceContext),
        containerConfigs,
        autoScaling,
        oneOrMoreTasksHasRouting,
        // This make it default to 'enabled'
        logging: ownServiceContext.params.logging !== 'disabled',
        logGroupName: `${ownServiceContext.appName}-${ownServiceContext.environmentName}-${ownServiceContext.serviceName}`,
        // Default to not set, which means infinite.
        logRetentionInDays: logRetention !== 0 ? logRetention! : null
    };

    // Configure routing if present in any of the containers
    if (oneOrMoreTasksHasRouting) {
        handlebarsParams.loadBalancer = routingSection.getLoadBalancerConfig(serviceParams, containerConfigs, clusterName, hostedZones, accountConfig);
    }

    // Add the SSH keypair if specified
    if (serviceParams.cluster && serviceParams.cluster.key_name) {
        handlebarsParams.sshKeyName = serviceParams.cluster.key_name;
    }

    // Add volumes if present (these are consumed by one or more container mount points)
    handlebarsParams.volumes = volumesSection.getVolumes(dependenciesDeployContexts);

    if (accountConfig.permissions_boundary) {
        handlebarsParams.permissionsBoundary = accountConfig.permissions_boundary
    }

    return handlebars.compileTemplate(`${__dirname}/ecs-service-template.yml`, handlebarsParams);
}

/**
 * This function creates a short resource name for the cluster. We don't use the standard cf stack name here because the max length
 *   of an ALB Target Group is 32 characters
 */
function getShortenedClusterName(serviceContext: ServiceContext<EcsServiceConfig>) {
    return `${serviceContext.appName.substring(0, 21)}-${serviceContext.environmentName.substring(0, 4)}-${serviceContext.serviceName.substring(0, 9)}`;
}

export class Service implements ServiceDeployer {
    public readonly producedDeployOutputTypes = [];
    public readonly consumedDeployOutputTypes = [
        DeployOutputType.EnvironmentVariables,
        DeployOutputType.Scripts,
        DeployOutputType.Policies,
        DeployOutputType.SecurityGroups
    ];
    public readonly producedEventsSupportedTypes = [];
    public readonly providedEventType = null;
    public readonly supportsTagging = true;

    public check(serviceContext: ServiceContext<EcsServiceConfig>, dependenciesServiceContexts: Array<ServiceContext<ServiceConfig>>): string[] {
        const errors: string[] = checkPhase.checkJsonSchema(`${__dirname}/params-schema.json`, serviceContext);
        routingSection.checkLoadBalancerSection(serviceContext, errors);
        containersSection.checkContainers(serviceContext, errors);
        return errors;
    }

    public async preDeploy(serviceContext: ServiceContext<EcsServiceConfig>): Promise<PreDeployContext> {
        return preDeployPhase.preDeployCreateSecurityGroup(serviceContext, 22, SERVICE_NAME);
    }

    public async getPreDeployContext(serviceContext: ServiceContext<EcsServiceConfig>): Promise<PreDeployContext> {
        return preDeployPhase.getSecurityGroup(serviceContext);
    }

    public async deploy(ownServiceContext: ServiceContext<EcsServiceConfig>, ownPreDeployContext: PreDeployContext, dependenciesDeployContexts: DeployContext[]): Promise<DeployContext> {
        const stackName = ownServiceContext.stackName();
        winston.info(`${SERVICE_NAME} - Deploying service '${stackName}'`);

        const clusterName = getShortenedClusterName(ownServiceContext);
        const instancesToCycle = await asgCycling.getInstancesToCycle(ownServiceContext, DEFAULT_INSTANCE_TYPE);
        await clusterAutoScalingSection.createAutoScalingLambdaIfNotExists(ownServiceContext.accountConfig);
        await clusterAutoScalingSection.createDrainingLambdaIfNotExists(ownServiceContext.accountConfig);
        const userDataScript = await cluster.getUserDataScript(clusterName, dependenciesDeployContexts);
        const compiledTemplate = await getCompiledEcsTemplate(stackName, clusterName, ownServiceContext, ownPreDeployContext, dependenciesDeployContexts, userDataScript);
        const stackTags = tagging.getTags(ownServiceContext);
        const deployedStack = await deployPhase.deployCloudFormationStack(ownServiceContext, stackName, compiledTemplate, [], true, 30, stackTags);
        await asgCycling.cycleInstances(instancesToCycle);
        winston.info(`${SERVICE_NAME} - Finished deploying service '${stackName}'`);
        return new DeployContext(ownServiceContext);
    }

    public async unPreDeploy(ownServiceContext: ServiceContext<EcsServiceConfig>): Promise<UnPreDeployContext> {
        return deletePhases.unPreDeploySecurityGroup(ownServiceContext, SERVICE_NAME);
    }

    public async unDeploy(ownServiceContext: ServiceContext<EcsServiceConfig>): Promise<UnDeployContext> {
        return deletePhases.unDeployService(ownServiceContext, SERVICE_NAME);
    }
}
