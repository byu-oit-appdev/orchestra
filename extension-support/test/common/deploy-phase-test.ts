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
import {expect} from 'chai';
import * as fs from 'fs';
import {DeployContext, ServiceConfig, ServiceContext, ServiceType} from 'handel-extension-api';
import 'mocha';
import * as sinon from 'sinon';
import * as cloudFormationCalls from '../../src/aws/cloudformation-calls';
import * as s3Calls from '../../src/aws/s3-calls';
import * as ssmCalls from '../../src/aws/ssm-calls';
import * as deployPhase from '../../src/common/deploy-phase';
import * as util from '../../src/util/util';
import accountConfig from '../fake-account-config';

describe('Deploy phase common module', () => {
    let sandbox: sinon.SinonSandbox;
    let serviceContext: ServiceContext<ServiceConfig>;
    const appName = 'FakeApp';
    const envName = 'FakeEnv';
    const serviceName = 'FakeService';

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        serviceContext = new ServiceContext(appName, envName, serviceName, new ServiceType('someExtension', 'FakeType'), {type: 'FakeType'}, accountConfig);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('deployCloudFormationStack', () => {
        it('should create the stack if it doesnt exist yet', async () => {
            const ensureBucketStub = sandbox.stub(s3Calls, 'createBucketIfNotExists').resolves({});
            const uploadStringStub = sandbox.stub(s3Calls, 'uploadString').resolves({
                Location: 's3://fakelocation'
            });
            const cleanupStub = sandbox.stub(s3Calls, 'cleanupOldVersionsOfFiles').resolves({});
            const getStackStub = sandbox.stub(cloudFormationCalls, 'getStack').returns(Promise.resolve(null));
            const createStackStub = sandbox.stub(cloudFormationCalls, 'createStack').returns(Promise.resolve({}));
            const deployedStack = await deployPhase.deployCloudFormationStack(serviceContext, 'FakeStack', '', [], true, 30, {});
            expect(deployedStack).to.deep.equal({});
            expect(getStackStub.callCount).to.equal(1);
            expect(ensureBucketStub.callCount).to.equal(1);
            expect(uploadStringStub.callCount).to.equal(1);
            expect(cleanupStub.callCount).to.equal(1);
            expect(createStackStub.callCount).to.equal(1);
        });

        it('should update the stack if it exists and updates are supported', async () => {
            const ensureBucketStub = sandbox.stub(s3Calls, 'createBucketIfNotExists').resolves({});
            const uploadStringStub = sandbox.stub(s3Calls, 'uploadString').resolves({
                Location: 's3://fakelocation'
            });
            const cleanupStub = sandbox.stub(s3Calls, 'cleanupOldVersionsOfFiles').resolves({});
            const getStackStub = sandbox.stub(cloudFormationCalls, 'getStack').returns(Promise.resolve({}));
            const updateStackStub = sandbox.stub(cloudFormationCalls, 'updateStack').returns(Promise.resolve({}));
            const deployedStack = await deployPhase.deployCloudFormationStack(serviceContext, 'FakeStack', '', [], true, 30, {});
            expect(deployedStack).to.deep.equal({});
            expect(getStackStub.callCount).to.equal(1);
            expect(ensureBucketStub.callCount).to.equal(1);
            expect(uploadStringStub.callCount).to.equal(1);
            expect(cleanupStub.callCount).to.equal(1);
            expect(updateStackStub.callCount).to.equal(1);
        });

        it('should just return the stack if it exists and updates are not supported', async () => {
            const uploadStringStub = sandbox.stub(s3Calls, 'uploadString').rejects(new Error());
            const getStackStub = sandbox.stub(cloudFormationCalls, 'getStack').returns(Promise.resolve({}));
            const updateStackStub = sandbox.stub(cloudFormationCalls, 'updateStack').returns(Promise.resolve(null));
            const deployedStack = await deployPhase.deployCloudFormationStack(serviceContext, 'FakeStack', '', [], false, 30, {});
            expect(deployedStack).to.deep.equal({});
            expect(getStackStub.callCount).to.equal(1);
            expect(uploadStringStub.callCount).to.equal(0);
            expect(updateStackStub.callCount).to.equal(0);
        });
    });

    describe('getHandelUploadsBucketName', () => {
        it('should return the name of the bucket used by Handel for application uploads', () => {
            const bucketName = deployPhase.getHandelUploadsBucketName(accountConfig);
            expect(bucketName).to.equal('handel-us-west-2-123456789012');
        });
    });

    describe('uploadFileToHandelBucket', () => {
        it('should upload the given file to the bucket', async () => {
            const diskFilePath = 'FakePath';
            const artifactPrefix = 'FakePrefix';
            const s3FileName = 'SomeFileName';

            // Stub out dependent services
            const createBucketStub = sandbox.stub(s3Calls, 'createBucketIfNotExists').returns(Promise.resolve({}));
            const uploadFileStub = sandbox.stub(s3Calls, 'uploadFile').returns({});
            const cleanupOldVersionsStub = sandbox.stub(s3Calls, 'cleanupOldVersionsOfFiles').returns(Promise.resolve(null));

            const s3ObjectInfo = await deployPhase.uploadFileToHandelBucket(diskFilePath, artifactPrefix, s3FileName, serviceContext.accountConfig);
            expect(createBucketStub.callCount).to.equal(1);
            expect(uploadFileStub.callCount).to.equal(1);
            expect(cleanupOldVersionsStub.callCount).to.equal(1);
            expect(s3ObjectInfo).to.deep.equal({});
        });
    });

    describe('uploadDeployableArtifactToHandelBucket', () => {
        it('should upload a file to the given s3 location', async () => {
            const pathToArtifact = `${__dirname}/mytestartifact.war`;
            const s3FileName = 'FakeS3Filename';

            const createBucketStub = sandbox.stub(s3Calls, 'createBucketIfNotExists').resolves({});
            const uploadFileStub = sandbox.stub(s3Calls, 'uploadFile').resolves({});
            const cleanupFilesStub = sandbox.stub(s3Calls, 'cleanupOldVersionsOfFiles').resolves({});

            const s3ObjectInfo = await deployPhase.uploadDeployableArtifactToHandelBucket(serviceContext, pathToArtifact, s3FileName);
            expect(createBucketStub.callCount).to.equal(1);
            expect(uploadFileStub.callCount).to.equal(1);
            expect(cleanupFilesStub.callCount).to.equal(1);
            expect(s3ObjectInfo).to.deep.equal({});
        });

        it('should zip and upload a directory to the given s3 location', async () => {
            const pathToArtifact = __dirname;
            const s3FileName = 'FakeS3Filename';

            const zipDirectoryToFileStub = sandbox.stub(util, 'zipDirectoryToFile').returns(Promise.resolve({}));
            const createBucketStub = sandbox.stub(s3Calls, 'createBucketIfNotExists').resolves({});
            const uploadFileStub = sandbox.stub(s3Calls, 'uploadFile').resolves({});
            const cleanupFilesStub = sandbox.stub(s3Calls, 'cleanupOldVersionsOfFiles').resolves({});
            const unlinkSyncStub = sandbox.stub(fs, 'unlinkSync').returns(null);

            const s3ObjectInfo = await deployPhase.uploadDeployableArtifactToHandelBucket(serviceContext, pathToArtifact, s3FileName);
            expect(zipDirectoryToFileStub.callCount).to.equal(1);
            expect(createBucketStub.callCount).to.equal(1);
            expect(uploadFileStub.callCount).to.equal(1);
            expect(cleanupFilesStub.callCount).to.equal(1);
            expect(unlinkSyncStub.callCount).to.equal(1);
            expect(s3ObjectInfo).to.deep.equal({});
        });
    });

    describe('getAllPolicyStatementsForServiceRole', () => {
        it('should return the combination of policy statements from the own service and its dependencies', () => {
            const ownServicePolicyStatements = [{
                'Effect': 'Allow',
                'Action': [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents'
                ],
                'Resource': [
                    'arn:aws:logs:*:*:*'
                ]
            }];

            const dependenciesDeployContexts = [];
            const dependencyServiceContext = new ServiceContext('FakeApp', 'FakeEnv', 'FakeService', new ServiceType('someExtension', 'sqs'), {type: 'sqs'}, serviceContext.accountConfig);
            const dependencyDeployContext = new DeployContext(dependencyServiceContext);
            dependencyDeployContext.policies.push({
                'Effect': 'Allow',
                'Action': [
                    'sqs:ChangeMessageVisibility',
                    'sqs:ChangeMessageVisibilityBatch',
                    'sqs:DeleteMessage',
                    'sqs:DeleteMessageBatch',
                    'sqs:GetQueueAttributes',
                    'sqs:GetQueueUrl',
                    'sqs:ListDeadLetterSourceQueues',
                    'sqs:ListQueues',
                    'sqs:PurgeQueue',
                    'sqs:ReceiveMessage',
                    'sqs:SendMessage',
                    'sqs:SendMessageBatch'
                ],
                'Resource': [
                    'SomeQueueArn'
                ]
            });
            dependenciesDeployContexts.push(dependencyDeployContext);

            const policyStatements = deployPhase.getAllPolicyStatementsForServiceRole(serviceContext, ownServicePolicyStatements, dependenciesDeployContexts, true);
            expect(policyStatements.length).to.equal(5); // 2 of our own, plus 3 for the app secrets
            expect(policyStatements[3].Resource[0]).to.contain(`parameter/${appName}.${envName}.*`);
            expect(policyStatements[3].Resource[1]).to.contain(`parameter/${appName}/${envName}/*`);
            expect(policyStatements[3].Resource[2]).to.contain(`parameter/handel/global/*`);
            expect(policyStatements[3].Resource[3]).to.contain(`parameter/handel.global.*`);
        });
        it('should optionally include permissions to put and get cloudwatch metrics', async () => {
            const ownServicePolicyStatements = [{
                'Effect': 'Allow',
                'Action': [
                    'logs:CreateLogGroup',
                    'logs:CreateLogStream',
                    'logs:PutLogEvents'
                ],
                'Resource': [
                    'arn:aws:logs:*:*:*'
                ]
            }];

            const dependenciesDeployContexts = [];
            const dependencyServiceContext = new ServiceContext('FakeApp', 'FakeEnv', 'FakeService', new ServiceType('someExtension', 'sqs'), {type: 'sqs'}, serviceContext.accountConfig);
            const dependencyDeployContext = new DeployContext(dependencyServiceContext);
            dependenciesDeployContexts.push(dependencyDeployContext);

            const policyStatements = deployPhase.getAllPolicyStatementsForServiceRole(serviceContext, ownServicePolicyStatements, dependenciesDeployContexts, false, true);
            expect(policyStatements.length).to.equal(2); // 1 for logs, 1 for metrics
            expect(policyStatements).to.deep.include({
                Effect: 'Allow',
                Action: ['cloudwatch:PutMetricData'],
                Resource: [
                    '*'
                ]
            });
        });
    });

    describe('addItemToSSMParameterStore', () => {
        it('should store the database password to the parameter store', async () => {
            const storeParamStub = sandbox.stub(ssmCalls, 'storeParameter').resolves(true);
            const result = await deployPhase.addItemToSSMParameterStore(serviceContext, 'db_username', 'FakeUsername');

            expect(result).to.equal(true);
            expect(storeParamStub.callCount).to.equal(2);

            const actualNames = storeParamStub.getCalls().map(it => it.args[0]);
            const actualTypes = storeParamStub.getCalls().map(it => it.args[1]);
            const actualValues = storeParamStub.getCalls().map(it => it.args[2]);

            expect(actualNames).to.include(
                'FakeApp.FakeEnv.FakeService.db_username'
            );
            expect(actualNames).to.include(
                '/FakeApp/FakeEnv/FakeService/db_username'
            );
            expect(actualTypes).to.eql(['SecureString', 'SecureString']);
            expect(actualValues).to.eql(['FakeUsername', 'FakeUsername']);
        });
    });

    describe('Inject env vars from handel file', () => {
        it('should inject env vars when properties are not specified', async () => {
            const dependencyServiceContext = new ServiceContext<ServiceConfig>('fakeApp', 'fakeEnv', 'fakeService', new ServiceType('someExtension', 'dynamodb'), {type: 'dynamodb'}, accountConfig);
            const dependencyDeployContext = new DeployContext(dependencyServiceContext);
            dependencyDeployContext.addEnvironmentVariables({
                TEST_DEPENDENCY_VAR: 'test_value2'
            });
            const dependenciesDeployContexts = [dependencyDeployContext];
            const userProvidedEnvVars = {
                TEST_USER_VAR: 'test_value'
            };
            const envVars = deployPhase.getEnvVarsForDeployedService(serviceContext, dependenciesDeployContexts, userProvidedEnvVars);
            expect(envVars.HANDEL_REGION_NAME).to.equal('us-west-2');
            expect(envVars.HANDEL_APP_NAME).to.equal('FakeApp');
            expect(envVars.HANDEL_ENVIRONMENT_NAME).to.equal('FakeEnv');
            expect(envVars.HANDEL_SERVICE_NAME).to.equal('FakeService');
            expect(envVars.HANDEL_PARAMETER_STORE_PREFIX).to.equal('FakeApp.FakeEnv');
            expect(envVars.TEST_USER_VAR).to.equal('test_value');
            expect(envVars.FAKESERVICE_TEST_DEPENDENCY_VAR).to.equal('test_value2');
        });
    });
});
