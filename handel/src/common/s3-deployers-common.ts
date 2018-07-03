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
import { AccountConfig, ServiceConfig, ServiceContext, Tags } from 'handel-extension-api';
import { awsCalls, handlebars } from 'handel-extension-support';

async function deployStack(stackName: string, cfTemplate: string, timeout: number, tags: Tags) {
    const stack = await awsCalls.cloudFormation.getStack(stackName);
    if (!stack) {
        return awsCalls.cloudFormation.createStack(stackName, cfTemplate, [], timeout, tags);
    }
    else {
        return stack;
    }
}

export async function createLoggingBucketIfNotExists(accountConfig: AccountConfig) {
    const stackName = 'HandelS3LoggingBucket';
    const bucketName = `handel-s3-bucket-logging-${accountConfig.region}-${accountConfig.account_id}`;
    const handlebarsParams = {
        bucketName
    };
    const compiledTemplate = await handlebars.compileTemplate(`${__dirname}/s3-static-site-logging-bucket.yml`, handlebarsParams);
    const deployedStack = await deployStack(stackName, compiledTemplate, 30, accountConfig.handel_resource_tags || {});
    return awsCalls.cloudFormation.getOutput('BucketName', deployedStack);
}

export function getLogFilePrefix(serviceContext: ServiceContext<ServiceConfig>) {
    return `${serviceContext.appName}/${serviceContext.environmentName}/${serviceContext.serviceName}/`;
}
