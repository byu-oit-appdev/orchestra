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
import * as fs from 'fs';
import {
    AccountConfig,
    DeployContext,
    EnvironmentVariables,
    ServiceConfig,
    ServiceContext,
    Tags
} from 'handel-extension-api';
import * as os from 'os';
import * as uuid from 'uuid';
import * as cloudFormationCalls from '../aws/cloudformation-calls';
import * as s3Calls from '../aws/s3-calls';
import * as ssmCalls from '../aws/ssm-calls';
import * as util from '../util/util';

// ------------------------------------------------------------------------------
// Public functions
// ------------------------------------------------------------------------------
export async function deployCloudFormationStack(serviceContext: ServiceContext<ServiceConfig>, stackName: string, cfTemplate: string, cfParameters: AWS.CloudFormation.Parameters, updatesSupported: boolean, timeoutInMinutes: number, stackTags: Tags) {
    // Upload template
    const stack = await cloudFormationCalls.getStack(stackName);
    if (!stack) {
        const s3ObjectData = await uploadCFTemplateToHandelBucket(serviceContext, cfTemplate);
        return cloudFormationCalls.createStack(stackName, s3ObjectData.Location, cfParameters, timeoutInMinutes, stackTags);
    } else {
        if (updatesSupported) {
            const s3ObjectData = await uploadCFTemplateToHandelBucket(serviceContext, cfTemplate);
            return cloudFormationCalls.updateStack(stackName, s3ObjectData.Location, cfParameters, stackTags);
        } else { // Updates not supported, so just return stack
            return stack;
        }
    }
}

export function getEnvVarsForDeployedService(ownServiceContext: ServiceContext<ServiceConfig>, dependenciesDeployContexts: DeployContext[], userProvidedEnvVars: EnvironmentVariables | undefined): EnvironmentVariables {
    let environmentVariables = {};

    // Inject env vars defined by service (if any)
    if (userProvidedEnvVars) {
        environmentVariables = Object.assign(environmentVariables, userProvidedEnvVars);
    }

    // Inject env vars defined by dependencies
    const dependenciesEnvVars = getEnvVarsFromDependencyDeployContexts(dependenciesDeployContexts);
    environmentVariables = Object.assign(environmentVariables, dependenciesEnvVars);

    // Inject env vars from Handel file
    const handelInjectedEnvVars = ownServiceContext.injectedEnvVars();
    environmentVariables = Object.assign(environmentVariables, handelInjectedEnvVars);

    return environmentVariables;
}

export function getHandelUploadsBucketName(accountConfig: AccountConfig) {
    return `handel-${accountConfig.region}-${accountConfig.account_id}`;
}

export async function uploadFileToHandelBucket(diskFilePath: string, artifactPrefix: string, s3FileName: string, accountConfig: AccountConfig): Promise<AWS.S3.ManagedUpload.SendData> {
    const bucketName = await ensureHandelBucketCreated(accountConfig);
    const artifactKey = `${artifactPrefix}/${s3FileName}`;
    const s3ObjectInfo = await s3Calls.uploadFile(bucketName, artifactKey, diskFilePath);
    await s3Calls.cleanupOldVersionsOfFiles(bucketName, artifactPrefix);
    return s3ObjectInfo;
}

export async function uploadStringToHandelBucket(content: string, artifactPrefix: string, s3FileName: string, accountConfig: AccountConfig): Promise<AWS.S3.ManagedUpload.SendData> {
    const bucketName = await ensureHandelBucketCreated(accountConfig);
    const artifactKey = `${artifactPrefix}/${s3FileName}`;
    const s3ObjectInfo = await s3Calls.uploadString(bucketName, artifactKey, content);
    await s3Calls.cleanupOldVersionsOfFiles(bucketName, artifactPrefix);
    return s3ObjectInfo;
}

export async function uploadDirectoryToHandelBucket(directoryPath: string, artifactPrefix: string, s3FileName: string, accountConfig: AccountConfig): Promise<AWS.S3.ManagedUpload.SendData> {
    const zippedPath = `${os.tmpdir()}/${uuid()}`;
    await util.zipDirectoryToFile(directoryPath, zippedPath);
    const s3ObjectInfo = await uploadFileToHandelBucket(zippedPath, artifactPrefix, s3FileName, accountConfig);
    fs.unlinkSync(zippedPath); // Delete temporary file
    return s3ObjectInfo;
}

export async function uploadCFTemplateToHandelBucket(serviceContext: ServiceContext<ServiceConfig>, templateBody: string): Promise<AWS.S3.ManagedUpload.SendData> {
    const accountConfig = serviceContext.accountConfig;
    const prefix = getServiceUploadLocation(serviceContext);
    const filename = `cfTemplates/template-${uuid()}`;
    return uploadStringToHandelBucket(templateBody, prefix, filename, accountConfig);
}

export async function uploadDeployableArtifactToHandelBucket(serviceContext: ServiceContext<ServiceConfig>, pathToArtifact: string, s3FileName: string): Promise<AWS.S3.ManagedUpload.SendData> {
    const accountConfig = serviceContext.accountConfig;
    const fileStats = fs.lstatSync(pathToArtifact);
    const artifactPrefix = getServiceUploadLocation(serviceContext);
    if (fileStats.isDirectory()) { // Zip up artifact and upload it
        return uploadDirectoryToHandelBucket(pathToArtifact, artifactPrefix, s3FileName, accountConfig);
    } else { // Is file (i.e. WAR file or some other already-compiled archive), just upload directly
        return uploadFileToHandelBucket(pathToArtifact, artifactPrefix, s3FileName, accountConfig);
    }
}

export function getAllPolicyStatementsForServiceRole(serviceContext: ServiceContext<ServiceConfig>, ownServicePolicyStatements: any[], dependenciesDeployContexts: any[], includeAppSecretsStatements: boolean, includePutMetricStatements: boolean = false): any[] {
    const policyStatementsToConsume = [];

    // Add policies from dependencies that have them
    for (const deployContext of dependenciesDeployContexts) {
        for (const policyDoc of deployContext.policies) {
            policyStatementsToConsume.push(policyDoc);
        }
    }

    // Let consuming service add its own policy if needed
    for (const ownServicePolicyStatement of ownServicePolicyStatements) {
        policyStatementsToConsume.push(ownServicePolicyStatement);
    }

    if (includeAppSecretsStatements) {
        const applicationParameters = `arn:aws:ssm:${serviceContext.accountConfig.region}:${serviceContext.accountConfig.account_id}:parameter/${serviceContext.ssmApplicationPrefix()}.*`;
        const applicationParametersPath = `arn:aws:ssm:${serviceContext.accountConfig.region}:${serviceContext.accountConfig.account_id}:parameter/${serviceContext.ssmApplicationPath()}*`
            .replace(/\/+/g, '/');
        const appSecretsAcessStatements = [
            {
                Effect: 'Allow',
                Action: [
                    'ssm:DescribeParameters'
                ],
                Resource: [
                    '*'
                ]
            },
            {
                Effect: 'Allow',
                Action: [
                    'ssm:GetParameters',
                    'ssm:GetParameter',
                    'ssm:GetParametersByPath'
                ],
                Resource: [
                    applicationParameters,
                    applicationParametersPath,
                    `arn:aws:ssm:${serviceContext.accountConfig.region}:${serviceContext.accountConfig.account_id}:parameter/handel/global/*`,
                    `arn:aws:ssm:${serviceContext.accountConfig.region}:${serviceContext.accountConfig.account_id}:parameter/handel.global.*`
                ]
            },
            {
                Effect: 'Allow',
                Action: [
                    'ssm:PutParameter',
                    'ssm:DeleteParameter',
                    'ssm:DeleteParameters'
                ],
                Resource: [
                    applicationParameters,
                    applicationParametersPath
                ]
            }
        ];
        policyStatementsToConsume.push(...appSecretsAcessStatements);
    }
    if (includePutMetricStatements) {
        const putMetricStatements = [
            {
                Effect: 'Allow',
                Action: [
                    'cloudwatch:PutMetricData'
                ],
                Resource: [
                    '*' // CloudWatch only allows '*' for metric permissions 🤷
                ]
            }
        ];
        policyStatementsToConsume.push(...putMetricStatements);
    }

    return policyStatementsToConsume;
}

export async function addItemToSSMParameterStore(ownServiceContext: ServiceContext<ServiceConfig>, paramName: string, paramValue: string): Promise<boolean> {
    const promises = ownServiceContext.allSsmParamNames(paramName)
        .map(it => {
            ssmCalls.storeParameter(it, 'SecureString', paramValue);
        });

    await Promise.all(promises);

    return true;
}

// ------------------------------------------------------------------------------
// Private functions
// ------------------------------------------------------------------------------
function getEnvVarsFromDependencyDeployContexts(deployContexts: DeployContext[]): EnvironmentVariables {
    const envVars: EnvironmentVariables = {};
    for (const deployContext of deployContexts) {
        Object.assign(envVars, deployContext.environmentVariables);
    }
    return envVars;
}

async function ensureHandelBucketCreated(accountConfig: AccountConfig): Promise<string> {
    const bucketName = getHandelUploadsBucketName(accountConfig);
    await s3Calls.createBucketIfNotExists(bucketName, accountConfig.region, accountConfig.handel_resource_tags); // Ensure Handel bucket exists in this region
    return bucketName;
}

function getServiceUploadLocation(serviceContext: ServiceContext<ServiceConfig>): string {
    return `${serviceContext.appName}/${serviceContext.environmentName}/${serviceContext.serviceName}`;
}
