import * as awsTags from './aws/aws-tags';
import * as cloudFormationCalls from './aws/cloudformation-calls';
import * as ec2Calls from './aws/ec2-calls';
import * as s3Calls from './aws/s3-calls';
import * as ssmCalls from './aws/ssm-calls';
import * as bindPhaseModule from './common/bind-phase';
import * as checkPhaseModule from './common/check-phase';
import * as deletePhasesModule from './common/delete-phases';
import * as deployPhaseModule from './common/deploy-phase';
import * as preDeployPhaseModule from './common/pre-deploy-phase';
import * as taggingModule from './common/tagging';
import * as handlebarsUtils from './util/handlebars-utils';
import * as utilModule from './util/util';

export const checkPhase = checkPhaseModule;
export const bindPhase = bindPhaseModule;
export const deletePhases = deletePhasesModule;
export const deployPhase = deployPhaseModule;
export const preDeployPhase = preDeployPhaseModule;
export const tagging = taggingModule;

export const awsCalls = {
    cloudFormation: cloudFormationCalls,
    ec2: ec2Calls,
    s3: s3Calls,
    tags: awsTags,
    ssm: ssmCalls
};

export const handlebars = handlebarsUtils;
export const util = utilModule;
