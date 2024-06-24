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
import {AccountConfig, DeployContext, ServiceContext, ServiceType} from 'handel-extension-api';
import {awsCalls} from 'handel-extension-support';
import 'mocha';
import * as sinon from 'sinon';
import config from '../../src/account-config/account-config';
import * as ecsContainers from '../../src/common/ecs-containers';
import * as ecsRouting from '../../src/common/ecs-routing';
import * as ecsVolumes from '../../src/common/ecs-volumes';
import {FargateServiceConfig} from '../../src/services/ecs-fargate/config-types';
import {STDLIB_PREFIX} from '../../src/services/stdlib';

describe('ecs containers common module', () => {
    let sandbox: sinon.SinonSandbox;
    let accountConfig: AccountConfig;
    let serviceContext: ServiceContext<FargateServiceConfig>;
    let serviceParams: FargateServiceConfig;
    const appName = 'FakeApp';
    const envName = 'FakeEnv';

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        accountConfig = await config(`${__dirname}/../test-account-config.yml`);
        serviceParams = {
            type: 'ecs',
            containers: [
                {
                    name: 'mycontainername',
                    image_name: '<account>/fakeimagename:latest',
                    environment_variables: {
                        MY_VAR: 'myValue'
                    },
                    routing: {
                        base_path: '/'
                    },
                    port_mappings: [
                        5000
                    ],
                    links: [
                        'otherContainer'
                    ]
                },
                {
                    name: 'otherContainer'
                }
            ],
            auto_scaling: {
                min_tasks: 1,
                max_tasks: 1
            }
        };
        serviceContext = new ServiceContext(appName, envName, 'FakeService', new ServiceType(STDLIB_PREFIX, 'ecs'), serviceParams, accountConfig);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getContainersConfig', () => {
        it('should return the configuration for containers from the Handel file', async () => {
            const getMountPointsStub = sandbox.stub(ecsVolumes, 'getMountPointsForContainer').returns([]);
            const getRoutingInfoStub = sandbox.stub(ecsRouting, 'getRoutingInformationForContainer').returns([]);

            const dependencyServiceContext = new ServiceContext(appName, envName, 'FakeOtherService', new ServiceType(STDLIB_PREFIX, 'efs'), {type: 'efs'}, accountConfig);
            const dependencyDeployContext = new DeployContext(dependencyServiceContext);
            const containerConfigs = await ecsContainers.getContainersConfig(serviceContext, [dependencyDeployContext], 'FakeClusterName');

            expect(getRoutingInfoStub.callCount).to.equal(1);
            expect(getMountPointsStub.callCount).to.equal(2);
            expect(containerConfigs.length).to.equal(2);
            expect(containerConfigs[0].name).to.equal('mycontainername');
        });
        describe('secrets injection', () => {
            function arnIt(name: string) {
                return `arn:aws:ssm:us-west-2:123456789012:parameter/${name}`.replace(/\/+/g, '/');
            }
            function nameAndArn(name: string) {
                return {
                    name,
                    arn: arnIt(name)
                };
            }

            const dep1Path1 = `/${appName}/${envName}/dep1/foo`;
            const dep1Path2 = `/${appName}/${envName}/dep1/bar`;
            const dep2Path1 = `/${appName}/${envName}/dep2/baz`;
            const dep1dot1 = `${appName}.${envName}.dep1.foo`;
            const dep1dot2 = `${appName}.${envName}.dep1.bar`;
            const dep2dot1 = `${appName}.${envName}.dep2.baz`;

            const dep1Path1Arn = arnIt(dep1Path1);
            const dep1Path2Arn = arnIt(dep1Path2);
            const dep2Path1Arn = arnIt(dep2Path1);
            const dep1dot1Arn = arnIt(dep1dot1);
            const dep1dot2Arn = arnIt(dep1dot2);
            const dep2dot1Arn = arnIt(dep2dot1);

            let dep1: DeployContext;
            let dep2: DeployContext;

            beforeEach(() => {
                dep1 = new DeployContext(new ServiceContext(appName, envName, 'dep1', new ServiceType(STDLIB_PREFIX, 'rds'), {type: 'rds'}, accountConfig));
                dep2 = new DeployContext(new ServiceContext(appName, envName, 'dep2', new ServiceType(STDLIB_PREFIX, 'rds'), {type: 'rds'}, accountConfig));
            });

            it('detects dependency secrets and injects them', async () => {
                sandbox.stub(awsCalls.ssm, 'listParameterNamesStartingWith')
                    .withArgs(dep1.ssmServicePath).resolves([dep1Path1, dep1Path2])
                    .withArgs(dep2.ssmServicePath).resolves([dep2Path1]);
                sandbox.stub(awsCalls.ssm, 'getArnsForNames').callsFake(a => a.map(nameAndArn));

                const result = await ecsContainers.getContainersConfig(serviceContext, [dep1, dep2], 'FakeClusterName');

                expect(result).to.have.lengthOf(2);
                result.forEach(value => expect(value).to.haveOwnProperty('secrets')
                    .which.eql({
                        DEP1_FOO: dep1Path1Arn,
                        DEP1_BAR: dep1Path2Arn,
                        DEP2_BAZ: dep2Path1Arn
                    })
                );
            });
            it('handles mixed dot-style and path-style dependency secrets', async () => {
                sandbox.stub(awsCalls.ssm, 'listParameterNamesStartingWith')
                    .withArgs(dep1.ssmServicePath).resolves([dep1Path1, dep1Path2])
                    .withArgs(dep1.ssmServicePrefix + '.').resolves([dep1dot1, dep1dot2])
                    .withArgs(dep2.ssmServicePath).resolves([])
                    .withArgs(dep2.ssmServicePrefix + '.').resolves([dep2dot1]);
                sandbox.stub(awsCalls.ssm, 'getArnsForNames').callsFake(a => a.map(nameAndArn));

                const result = await ecsContainers.getContainersConfig(serviceContext, [dep1, dep2], 'FakeClusterName');

                expect(result).to.have.lengthOf(2);
                result.forEach(value => expect(value).to.haveOwnProperty('secrets')
                    .which.eql({
                        DEP1_FOO: dep1Path1Arn,
                        DEP1_BAR: dep1Path2Arn,
                        DEP2_BAZ: dep2dot1Arn
                    })
                );
            });
            it('injects secrets specified in the config');
        });
    });

    describe('checkContainers', () => {
        it('should return an error when no containers are specified', () => {
            serviceParams.containers = [];
            const errors: string[] = [];
            ecsContainers.checkContainers(serviceContext, errors);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include('You must specify at least one container');
        });

        it('should only allow one container to have routing', () => {
            serviceParams.containers[1].routing = {
                base_path: '/'
            };
            serviceParams.containers[1].port_mappings = [
                5000
            ];
            const errors: string[] = [];
            ecsContainers.checkContainers(serviceContext, errors);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`You may not specify a 'routing' section in more than one container.`);
        });

        it('should require port_mappings if routing is specified', () => {
            delete serviceParams.containers[0].port_mappings;
            const errors: string[] = [];
            ecsContainers.checkContainers(serviceContext, errors);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`The 'port_mappings' parameter is required`);
        });

        it('should require container links to be valid', () => {
            serviceParams.containers = [serviceParams.containers[0]];
            const errors: string[] = [];
            ecsContainers.checkContainers(serviceContext, errors);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.include(`You specified a link`);
        });

        it('should return no errors for a proper configuration', () => {
            const errors: string[] = [];
            ecsContainers.checkContainers(serviceContext, errors);
            expect(errors.length).to.equal(0);
        });
    });
});
