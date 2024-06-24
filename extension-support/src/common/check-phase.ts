import * as Ajv from 'ajv';
import * as fs from 'fs';
import {ServiceConfig, ServiceContext} from 'handel-extension-api';

export function checkJsonSchema(schemaPath: string, serviceContext: ServiceContext<ServiceConfig>): string[] {
    const ajv = new Ajv({allErrors: true, jsonPointers: true});
    require('ajv-errors')(ajv);
    let schema;
    try {
        schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    } catch (e) {
        return [`Couldn't read schema file to check the service schema`];
    }
    const valid = ajv.validate(schema, serviceContext.params);
    if (!valid) {
        return ajv.errors!.map(error => {
            const errorParams = error.params as any; // The types don't seem to be right on AJV when using AJV-errors, so we cast it to any here
            if (!!errorParams.errors) {
                const additionalPropsErrors = errorParams.errors.filter((errorParam: any) => errorParam.keyword === 'additionalProperties');
                if (additionalPropsErrors.length > 0) { // Special error message for the 'additionalProps' error to make it more understandable
                    const additionalPropsError = additionalPropsErrors[0];
                    return `Invalid property '${error.dataPath}/${additionalPropsError.params.additionalProperty}' specified. Make sure to check your spelling!`;
                }
            }
            const dataPath = error.dataPath || '/';
            return `Error at path '${dataPath}': ${error.message}`;
        });
    } else {
        return [];
    }
}
