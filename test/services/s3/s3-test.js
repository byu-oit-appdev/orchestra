const accountConfig = require('../../../lib/util/account-config')(`${__dirname}/../../test-account-config.yml`).getAccountConfig();
const s3 = require('../../../lib/services/s3');
const cloudfFormationCalls = require('../../../lib/aws/cloudformation-calls');
const ServiceContext = require('../../../lib/datatypes/service-context');
const DeployContext = require('../../../lib/datatypes/deploy-context');
const PreDeployContext = require('../../../lib/datatypes/pre-deploy-context');
const BindContext = require('../../../lib/datatypes/bind-context');
const sinon = require('sinon');
const expect = require('chai').expect;

describe('s3 deployer', function() {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('check', function() {
        it('should require the versioning parameter to be a certain value when present', function() {
            let serviceContext = {
                params: {
                    bucket_name: 'somename',
                    versioning: 'othervalue'
                }
            }
            let errors = s3.check(serviceContext);
            expect(errors.length).to.equal(1);
            expect(errors[0]).to.contain("'versioning' parameter must be either 'enabled' or 'disabled'");
        });

        it('should work when there are no configuration errors', function() {
            let serviceContext = {
                params: {
                    bucket_name: 'somename',
                    versioning: 'enabled'
                }
            }
            let errors = s3.check(serviceContext);
            expect(errors.length).to.equal(0);
        });
    });

    describe('preDeploy', function() {
        it('should return an empty predeploy context', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return s3.preDeploy(serviceContext)
                .then(preDeployContext => {
                    expect(preDeployContext).to.be.instanceof(PreDeployContext);
                });
        });
    });

    describe('getPreDeployContextForExternalRef', function() {
        it('should return an empty preDeployContext', function() {
            let externalRefServiceContext = new ServiceContext("FakeName", "FakeEnv", "FakeService", "FakeType", "1", {});
            return s3.getPreDeployContextForExternalRef(externalRefServiceContext)
                .then(externalRefPreDeployContext => {
                    expect(externalRefPreDeployContext).to.be.instanceof(PreDeployContext);
                });
        })
    });

    describe('bind', function() {
        it('should return an empty bind context', function() {
            let serviceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "FakeType", "1", {});
            return s3.bind(serviceContext)
                .then(bindContext => {
                    expect(bindContext).to.be.instanceof(BindContext);
                });
        });
    });
    
    describe('getBindContextForExternalRef', function() {
        it('should return an empty bind context', function() {
            return s3.getBindContextForExternalRef(null, null, null, null)
                .then(externalBindContext => {
                    expect(externalBindContext).to.be.instanceof(BindContext);
                });
        });
    });

    describe('deploy', function() {
        let appName = "FakeApp";
        let envName = "FakeEnv";
        let deployVersion = "1";
        let bucketName = "my-bucket";
        let serviceContext = new ServiceContext(appName, envName, "FakeService", "s3", deployVersion, {
            bucket_name: bucketName
        });
        let preDeployContext = new PreDeployContext(serviceContext);

        it('should create a new bucket when it doesnt exist', function() {
            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve(null));
            let createStackStub = sandbox.stub(cloudfFormationCalls, 'createStack').returns(Promise.resolve({
                Outputs: [{
                    OutputKey: 'BucketName',
                    OutputValue: bucketName
                }]
            }))

            return s3.deploy(serviceContext, preDeployContext, [])
                .then(deployContext => {
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(createStackStub.calledOnce).to.be.true;
                    expect(deployContext).to.be.instanceof(DeployContext);
                    expect(deployContext.policies.length).to.equal(2);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_BUCKET_NAME"]).to.equal(bucketName);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_BUCKET_URL"]).to.contain(bucketName);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_REGION_ENDPOINT"]).to.exist;
                });
        });

        it('should update an existing bucket when it exists', function() {
            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve({}));
            let updateStackStub = sandbox.stub(cloudfFormationCalls, 'updateStack').returns(Promise.resolve({
                Outputs: [{
                    OutputKey: 'BucketName',
                    OutputValue: bucketName
                }]
            }))

            return s3.deploy(serviceContext, preDeployContext, [])
                .then(deployContext => {
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(updateStackStub.calledOnce).to.be.true;
                    expect(deployContext).to.be.instanceof(DeployContext);
                    expect(deployContext.policies.length).to.equal(2);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_BUCKET_NAME"]).to.equal(bucketName);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_BUCKET_URL"]).to.contain(bucketName);
                    expect(deployContext.environmentVariables["S3_FAKEAPP_FAKEENV_FAKESERVICE_REGION_ENDPOINT"]).to.exist;
                });
        });
    });

    describe('getDeployContextForExternalRef', function() {
        it('should return a DeployContext if the service has been deployed', function() {
            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve({
                Outputs: [{
                    OutputKey: 'BucketName',
                    OutputValue: 'FakeBucket'
                }]
            }));
            let externalServiceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", {});            
            return s3.getDeployContextForExternalRef(externalServiceContext)
                .then(externalDeployContext => {
                    expect(getStackStub.calledOnce).to.be.true;
                    expect(externalDeployContext).to.be.instanceof(DeployContext);
                });
        });

        it('should return an error if the service hasnt been deployed yet', function() {
            let getStackStub = sandbox.stub(cloudfFormationCalls, 'getStack').returns(Promise.resolve(null));
            let externalServiceContext = new ServiceContext("FakeApp", "FakeEnv", "FakeService", "dynamodb", "1", {});            
            return s3.getDeployContextForExternalRef(externalServiceContext)
                .then(externalDeployContext => {
                    expect(true).to.equal(false); //Should not get here
                })
                .catch(err => {
                    expect(err.message).to.contain('You must deploy it independently');
                    expect(getStackStub.calledOnce).to.be.true;
                });
        });
    });

    describe('consumeEvents', function() {
        it('should return an error since it cant consume events', function() {
            return s3.consumeEvents(null, null, null, null)
                .then(() => {
                    expect(true).to.be.false; //Should not get here
                })
                .catch(err => {
                    expect(err.message).to.contain("S3 service doesn't consume events");
                });
        });
    });

    describe('getConsumeEventsContextForExternalRef', function() {
        it('should throw an error because S3 cant consume event services', function() {
            return s3.getConsumeEventsContextForExternalRef(null, null, null, null)
                .then(externalConsumeEventsContext => {
                    expect(true).to.be.false; //Shouldnt get here
                })
                .catch(err => {
                    expect(err.message).to.contain("S3 service doesn't consume events");
                });
        });
    });


    describe('produceEvents', function() {
        it('should return an error since it doesnt yet produce events', function() {
            return s3.produceEvents(null, null, null, null)
                .then(() => {
                    expect(true).to.be.false; //Should not get here
                })
                .catch(err => {
                    expect(err.message).to.contain("S3 service doesn't currently produce events");
                });
        });
    });
});