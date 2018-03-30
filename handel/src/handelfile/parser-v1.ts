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
import * as Ajv from 'ajv';
import {ServiceRegistry} from 'handel-extension-api';
import * as _ from 'lodash';
import * as util from '../common/util';
import { AccountConfig, EnvironmentContext, HandelFile, ServiceContext } from '../datatypes';
import {DEFAULT_EXTENSION_PREFIX} from '../service-registry';

const APP_ENV_SERVICE_NAME_REGEX = /^[a-zA-Z0-9-]+$/;

/**
 * Checks the top-level name field for correctness.
 */
function checkSchema(handelFile: HandelFile): string[] {
    const ajv = new Ajv({ allErrors: true, jsonPointers: true });
    require('ajv-errors')(ajv);
    const schema = util.readJsonFileSync(`${__dirname}/v1-schema.json`);
    const valid = ajv.validate(schema, handelFile);
    if (!valid) {
        return ajv.errors!.map(error => error.message!);
    }
    else {
        return [];
    }
}

/**
 * Checks the Handel environment fields for correctness.
 *
 * There are limits and requirements for each of the environment and service names, and this is where those are
 * checked.
 *
 * Service-specific parameters are not checked here. Instead, they are checked as one of the phases in
 * the deployer lifecycle, so the deployers themselves implement parameter checking for their service.
 */
function checkServiceTypes(handelFile: HandelFile, serviceRegistry: ServiceRegistry): string[] {
    const errors = [];

    // Check that each service type is supported by Handel
    for (const envName in handelFile.environments) {
        if (handelFile.environments.hasOwnProperty(envName)) {
            for (const serviceName in handelFile.environments[envName]) {
                if (handelFile.environments[envName].hasOwnProperty(serviceName)) {
                    const serviceType = handelFile.environments[envName][serviceName].type;

                    // Check that specified service type is supported by Handel
                    if (!serviceRegistry.hasService(DEFAULT_EXTENSION_PREFIX, serviceType)) {
                        errors.push(`Unsupported service type specified '${serviceType}'`);
                    }
                }
            }
        }
    }

    return errors;
}

/**
 * Checks the dependencies of each service to make sure that it is consumable by that service
 *
 * This is accomplished via the "producedDeployOutputTypes" and "consumedDeployOutputTypes" lists from
 * the deployer contract, where the deployers specify what output types they are able to produce and
 * consume
 */
function checkServiceDependencies(handelFile: HandelFile, serviceRegistry: ServiceRegistry): string[] {
    const errors = [];

    for (const envName in handelFile.environments) {
        if (handelFile.environments.hasOwnProperty(envName)) {
            const environmentDef = handelFile.environments[envName];
            for (const serviceName in environmentDef) {
                if (environmentDef.hasOwnProperty(serviceName)) {
                    const serviceDef = environmentDef[serviceName];
                    if (serviceDef.dependencies) { // Analyze those services that declare dependencies
                        for (const dependentServiceName of serviceDef.dependencies) {
                            // Make sure the dependent service exists in the environment
                            if (!environmentDef[dependentServiceName]) {
                                errors.push(`You declared a dependency '${dependentServiceName}' in the service '${serviceName}' that doesn't exist`);
                            }
                            else {
                                const dependentServiceDef = environmentDef[dependentServiceName];

                                // Make sure the dependent service produces outputs that the consuming service can consume
                                const serviceDeployer = serviceRegistry.getService(DEFAULT_EXTENSION_PREFIX, serviceDef.type);
                                const dependentServiceDeployer = serviceRegistry.getService(DEFAULT_EXTENSION_PREFIX, dependentServiceDef.type);
                                const serviceConsumedOutputs = serviceDeployer.consumedDeployOutputTypes;
                                const dependentServiceProducedOutputs = dependentServiceDeployer.producedDeployOutputTypes;
                                const consumeErrMsg = `The '${dependentServiceDef.type}' service type is not consumable by the '${serviceDef.type}' service type`;
                                if (dependentServiceProducedOutputs.length === 0) {
                                    errors.push(consumeErrMsg);
                                }
                                // _.difference usage here checks to see if dependentServiceProducedOutputs is a subset of serviceConsumedOutputs
                                else if (_.difference(dependentServiceProducedOutputs, serviceConsumedOutputs).length > 0) {
                                    errors.push(consumeErrMsg);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return errors;
}

/**
 * Checks the event_consumers of each service (if any) to make sure the producers and consumers are
 * compatible with each other
 *
 * This is accomplished via the "producedEventsSupportedServices" list from the
 * deployer contract, where the deployers specify what services (if any) can consume events
 * from that service.
 */
function checkEventConsumers(handelFile: HandelFile, serviceRegistry: ServiceRegistry) {
    const errors = [];

    for (const envName in handelFile.environments) {
        if (handelFile.environments.hasOwnProperty(envName)) {
            const environmentDef = handelFile.environments[envName];
            for (const serviceName in environmentDef) {
                if (environmentDef.hasOwnProperty(serviceName)) {
                    const serviceDef = environmentDef[serviceName];
                    if (serviceDef.event_consumers) {
                        for (const eventConsumerService of serviceDef.event_consumers) {
                            const eventConsumerServiceName = eventConsumerService.service_name;

                            // Make sure the event consumer service exists in the environment
                            if (!environmentDef[eventConsumerServiceName]) {
                                errors.push(`You declared an event consumer '${eventConsumerServiceName}' in the service '${serviceName}' that doesn't exist`);
                            }
                            const eventConsumerServiceDef = environmentDef[eventConsumerServiceName];

                            const serviceDeployer = serviceRegistry.getService(DEFAULT_EXTENSION_PREFIX, serviceDef.type);
                            const supportedConsumerTypes = serviceDeployer.producedEventsSupportedServices;
                            if (!supportedConsumerTypes.includes(eventConsumerServiceDef.type)) {
                                errors.push(`The '${eventConsumerServiceDef.type}' service type can't consume events from the '${serviceDef.type}' service type`);
                            }
                        }
                    }
                }
            }
        }
    }

    return errors;
}

/**
 * Ensure that the top-level of the Handel file is valid.
 *
 * This does not check the individual services in the file, those are handled by the
 * service deployer themselves.
 */
export async function validateHandelFile(handelFile: HandelFile, serviceRegistry: ServiceRegistry): Promise<string[]> {
    const schemaErrors = checkSchema(handelFile);
    if (schemaErrors.length > 0) {
        return schemaErrors;
    }
    else {
        let errors: string[] = [];

        // The app name 'handel' is not allowed
        if(handelFile.name === 'handel') {
            errors.push(`You may not use the name 'handel' for your app name`);
        }

        errors = errors.concat(checkServiceTypes(handelFile, serviceRegistry)); // Check that environment and services are valid (not all ones will work);
        if (errors.length > 0) {
            return errors;
        }
        else {
            errors = errors.concat(checkServiceDependencies(handelFile, serviceRegistry));
            errors = errors.concat(checkEventConsumers(handelFile, serviceRegistry));
            return errors;
        }
    }
}

/**
 * Given a Handel file, returns the EnvironmentContext for the requested environment.
 *
 * Assume all validation has been done previously, so jsut create the EnvironmentContext
 *
 * @param {Object} handelFile - The Object representing the provided YAML deploy spec file
 * @param {String} environmentName - The name of the environment in the deploy spec for which we want the EnvironmentContext
 * @param {AccountConfig} accountConfig - account configuration
 * @param {ServiceRegistry} serviceRegistry - registry of all loaded services
 * @returns {EnvironmentContext} - The generated EnvironmentContext from the specified environment in the Handel file
 */
export function createEnvironmentContext(handelFile: HandelFile, environmentName: string, accountConfig: AccountConfig, serviceRegistry: ServiceRegistry): EnvironmentContext {
    const environmentSpec = handelFile.environments[environmentName];
    if (!environmentSpec) {
        throw new Error(`Can't find the requested environment in the deploy spec: ${environmentName}`);
    }

    const environmentContext = new EnvironmentContext(handelFile.name, environmentName, accountConfig, handelFile.tags || {});

    _.forEach(environmentSpec, (serviceSpec, serviceName) => {
        const serviceType = serviceSpec.type;
        environmentContext.serviceContexts[serviceName] = new ServiceContext(
            handelFile.name, environmentName, serviceName,
            serviceType, serviceSpec, accountConfig, serviceRegistry, handelFile.tags || {}
        );
    });

    return environmentContext;
}
