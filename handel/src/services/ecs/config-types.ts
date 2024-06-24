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
import {ExtraSecrets, HasInjectableSecrets, ServiceConfig, Tags} from 'handel-extension-api';
import {
    AutoScalingConfig,
    ContainerConfig,
    HandlebarsEcsTemplateAutoScaling,
    HandlebarsEcsTemplateContainer,
    HandlebarsEcsTemplateLoadBalancer,
    HandlebarsEcsTemplateVolume,
    LoadBalancerConfig
} from '../../common/ecs-shared-config-types';

export interface EcsServiceConfig extends ServiceConfig {
    containers: ContainerConfig[];
    auto_scaling: AutoScalingConfig;
    cluster?: ClusterConfig;
    load_balancer?: LoadBalancerConfig;
    logging?: string;
    log_retention_in_days?: number;
    tags?: Tags;
}

export interface ClusterConfig {
    key_name?: string;
    instance_type?: string;
}

export interface HandlebarsEcsTemplateConfig {
    clusterName: string;
    stackName: string;
    instanceType: string;
    minInstances: number;
    maxInstances: number;
    ecsSecurityGroupId: string;
    amiImageId: string;
    userData: string;
    privateSubnetIds: string[];
    publicSubnetIds: string[];
    asgCooldown: string;
    minimumHealthyPercentDeployment: string;
    vpcId: string;
    serviceRoleName: string;
    policyStatements: any[];
    executionPolicyStatements: any[];
    deploymentSuffix: number;
    tags: Tags;
    containerConfigs: HandlebarsEcsTemplateContainer[];
    autoScaling: HandlebarsEcsTemplateAutoScaling;
    oneOrMoreTasksHasRouting: boolean;
    logging: boolean;
    logGroupName: string;
    logRetentionInDays: number | null;
    loadBalancer?: HandlebarsEcsTemplateLoadBalancer;
    sshKeyName?: string;
    volumes?: HandlebarsEcsTemplateVolume[];
    permissionsBoundary?: string;
}
