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
import 'mocha';
import * as sinon from 'sinon';
import awsWrapper from '../../src/aws/aws-wrapper';
import * as ssmCalls from '../../src/aws/ssm-calls';

describe('ssmCalls module', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('storeParameter', () => {
        it('should add the given parameter to the store', async () => {
            const putParameterStub = sandbox.stub(awsWrapper.ssm, 'putParameter').resolves({});

            const response = await ssmCalls.storeParameter('ParamName', 'ParamType', 'ParamValue');
            expect(response).to.deep.equal({});
            expect(putParameterStub.callCount).to.equal(1);
        });
    });

    describe('deleteParameters', () => {
        it('should delete the list of parameters from the store', async () => {
            const deleteParameterStub = sandbox.stub(awsWrapper.ssm, 'deleteParameter').resolves(true);

            const success = await ssmCalls.deleteParameters(['Param1', 'Param1']);
            expect(success).to.equal(true);
            expect(deleteParameterStub.callCount).to.equal(2);
        });
    });

    describe('listParameterNamesStartingWith', () => {
        it('makes a request to SSM with the correct filters', async () => {
            const stub = sandbox.stub(awsWrapper.ssm, 'describeParameters').resolves([]);

            await ssmCalls.listParameterNamesStartingWith('/foobar/', 'foo.bar.');

            const actualReq: AWS.SSM.DescribeParametersRequest = stub.firstCall.args[0];

            expect(actualReq.ParameterFilters).to.exist
                .and.to.eql([{
                Key: 'Name',
                Option: 'BeginsWith',
                Values: ['/foobar/', 'foo.bar.']
            }]);
        });
        it('extracts the names from the results', async () => {
            const stub = sandbox.stub(awsWrapper.ssm, 'describeParameters').resolves([
                {Name: '/foo/bar/baz'},
                {Name: 'foo.bar.baz'}
            ]);

            const result = await ssmCalls.listParameterNamesStartingWith('/foo/bar/', 'foo.bar.');

            expect(result).to.have.members(['/foo/bar/baz', 'foo.bar.baz']);
        });
    });
});
