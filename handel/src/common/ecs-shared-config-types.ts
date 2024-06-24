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
import {EnvironmentVariables, ExtraSecrets} from 'handel-extension-api';

export interface ContainerConfig {
    name: string;
    image_name?: string;
    port_mappings?: number[];
    max_mb?: number;
    cpu_units?: number;
    links?: string[];
    routing?: ContainerRoutingConfig;
    environment_variables?: EnvironmentVariables;
    secrets?: ExtraSecrets;
}

export interface ContainerRoutingConfig {
    base_path: string;
    health_check_path?: string;
}

export interface AutoScalingConfig {
    min_tasks: number;
    max_tasks: number;
    scaling_policies?: AutoScalingPolicyConfig[];
}

export interface AutoScalingPolicyConfig {
    type: AutoScalingPolicyType;
    adjustment: AutoScalingAdjustment;
    alarm: AutoScalingAlarm;
    cooldown?: number;
}

export enum AutoScalingPolicyType {
    Up = 'up',
    Down = 'down'
}

export interface AutoScalingAdjustment {
    type?: string;
    value: number;
    cooldown?: number;
}

export interface AutoScalingAlarm {
    namespace?: string;
    dimensions?: AutoScalingAlarmDimensions;
    metric_name: string;
    comparison_operator: string;
    threshold: number;
    period?: number;
    evaluation_periods?: number;
    aggregation_type?: string;
}

export interface AutoScalingAlarmDimensions {
    [key: string]: string;
}

export interface LoadBalancerConfig {
    type: LoadBalancerConfigType;
    timeout?: number;
    https_certificate?: string;
    dns_names: string[];
    health_check_grace_period?: number;
}

export enum LoadBalancerConfigType {
    HTTP = 'http',
    HTTPS = 'https'
}

export interface HandlebarsEcsTemplateContainer {
    name: string;
    maxMb: number;
    cpuUnits: number;
    environmentVariables: EnvironmentVariables;
    secrets?: Record<string, string>;
    routingInfo?: HandlebarsEcsTemplateRoutingInfo;
    portMappings: number[];
    imageName: string;
    mountPoints?: HandlebarsEcsTemplateMountPoint[];
    links?: string[];
}

export interface HandlebarsEcsTemplateRoutingInfo {
    healthCheckPath: string;
    basePath: string;
    albPriority: number;
    containerPort: string;
    targetGroupName: string;
}

export interface HandlebarsEcsTemplateMountPoint {
    containerPath: string;
    sourceVolume: string;
}

export interface HandlebarsEcsTemplateAutoScaling {
    minTasks: number;
    maxTasks: number;
    scalingEnabled?: boolean;
    scalingPolicies?: HandlebarsEcsTemplateScalingPolicy[];
}

export interface HandlebarsEcsTemplateScalingPolicy {
    adjustmentType: string;
    adjustmentValue: number;
    cooldown: number;
    metricAggregationType: string;
    comparisonOperator: string;
    dimensions?: HandlebarsEcsTemplateScalingDimension[] | null;
    metricName: string;
    namespace: string;
    period: number;
    evaluationPeriods: number;
    threshold: number;
    scaleUp?: boolean;
    scaleDown?: boolean;
}

export interface HandlebarsEcsTemplateScalingDimension {
    name: string;
    value: string;
}

export interface HandlebarsEcsTemplateLoadBalancer {
    timeout: number;
    type: string;
    defaultRouteContainer?: HandlebarsEcsTemplateContainer;
    httpsCertificate?: string;
    dnsNames?: HandlebarsEcsTemplateDnsName[];
    albName: string;
    healthCheckGracePeriod?: number;
}

export interface HandlebarsEcsTemplateDnsName {
    name: string;
    zoneId: string;
}

export interface HandlebarsEcsTemplateVolume {
    sourcePath: string;
    name: string;
}
