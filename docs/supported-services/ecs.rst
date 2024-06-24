.. _ecs:

ECS (Elastic Container Service)
===============================
This page contains information about the ECS service supported in Handel. This Handel service provisions your application code as an ECS Service, with included supporting infrastructure such as load balancers and auto-scaling groups.

Service Limitations
-------------------
One service per cluster
~~~~~~~~~~~~~~~~~~~~~~~
This service uses a model of one ECS service per ECS cluster. It does not support the model of one large cluster with multiple services running on it.

Unsupported ECS task features
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
This service currently does not support the following ECS task features:

* User-specified volumes from the EC2 host. You can specify services such as EFS that will mount a volume in your container for you, however.
* Extra networking items such as manually specifying DNS Servers, DNS Search Domains, and extra hosts in the /etc/hosts file
* Task definition options such as specifying an entry point, command, or working directory. These options are available in your Dockerfile and can be specified there.

.. IMPORTANT::

    This service only offers limited tagging support. ECS resources will not be tagged, but any load balancers, EC2 instances, and the Cloudformation stack used to create them will be. See :ref:`tagging-unsupported-resources`.

Parameters
----------
.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - type
     - string
     - Yes
     - 
     - This must always be *ecs* for this service type.
   * - containers
     - :ref:`ecs-containers`
     - Yes
     - 
     - This section allows you to configure one or more containers that will make up your service.
   * - auto_scaling
     - :ref:`ecs-autoscaling`
     - Yes
     - 
     - This section contains information about scaling your tasks up and down.
   * - cluster
     - :ref:`ecs-cluster`
     - No
     - 
     - This section contains items used to configure your ECS cluster of EC2 instances.   
   * - load_balancer
     - :ref:`ecs-loadbalancer`
     - No
     - 
     - If your task needs routing from a load balancer, this section can be used to configure the load balancer's options.
   * - logging
     - string
     - No
     - enabled
     - Turns CloudWatch logging on or off. Must be either "enabled" or "disabled". See :ref:`ecs-logging` for more.
   * - log_retention_in_days
     - number
     - No
     - 0
     - Configures the log retention duration for CloudWatch logs. If set to `0`, logs are kept indefinitely.
   * - tags
     - :ref:`tagging-resources`
     - No
     - 
     - This section allows you to specify any tags you wish to apply to your ECS service.

.. _ecs-containers:

Containers
~~~~~~~~~~
The `containers` section is defined by the following schema:

.. code-block:: yaml

    containers:
    - name: <string> # Required
      image_name: <string> # Optional
      port_mappings: # Optional, required if you specify 'routing'
      - <integer>
      max_mb: <integer> # Optional. Default: 128
      cpu_units: <integer> # Optional. Default: 100
      links: # Optional
      - <string> # Each value in the list should be the "name" field of another container in your containers list
      routing: # Optional
        base_path: <string> # Required
        health_check_path: <string> # Optional. Default: /
      environment_variables: # Optional
        <string>: <string>
      secrets:
        <string>:
          # either 'app:' or 'global:' - see "Secret Injection" below
          app: my-ssm-parameter-name

.. NOTE::

  You may currently only specify the `routing` section in a single container. Attempting to add routing to multiple containers in a single service will result in an error. This is due to a current limitation in the integration between Application Load Balancers (ALB) and ECS that only allows you to attach an ALB to a single container in your task.

Container Image Names
*********************
In each container, you may specify an optional *image_name*. If you want to pull a public image from somewhere like DockerHub, just reference the image name:

.. code-block:: none

    dsw88/my-cool-image

If you want to reference an image in your AWS account's EC2 Container Registry (ECR), reference it like this:

.. code-block:: none

    # The <account> piece will be replaced with your account's long ECR repository name
    <account>/my-cool-image

If you don't specify an *image_name*, Handel will automatically choose an image name for you based on your Handel naming information. It will use the following image naming pattern:

.. code-block:: none

    <appName>-<serviceName>-<containerName>:<environmentName>

For example, if you don't specify an *image_name* in the below :ref:`ecs-example-handel-files`, the two images ECS looks for would be named the following:

.. code-block:: none

    my-ecs-app-webapp-mywebapp:dev
    my-ecs-app-webapp-myothercontainer:dev


.. _ecs-autoscaling:

AutoScaling
~~~~~~~~~~~
The `auto_scaling` section is defined by the following schema:

.. code-block:: yaml

    auto_scaling:
      min_tasks: <integer> # Required
      max_tasks: <integer> # Required
      scaling_policies: # Optional
      - type: <up|down> # Required
        adjustment: # Required
          value: <number> # Required
          type: <string> # Optional. Default: 'ChangeInCapacity'. See http://docs.aws.amazon.com/ApplicationAutoScaling/latest/APIReference/API_StepScalingPolicyConfiguration.html for allowed values
          cooldown: <number> # Optional. Default: 300. 
        alarm: # Required
          metric_name: <string> # Required
          comparison_operator: <string> # Required. See http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cw-alarm.html#cfn-cloudwatch-alarms-comparisonoperator for allowed values.
          threshold: <number> # Required
          namespace: <string> # Optional. Default: 'AWS/ECS'
          dimensions: # Optional. Default: Your ECS service dimensions
            <string>: <string>
          period: <number> # Optional. Default: 300
          evaluation_periods: <number> # Optional. Default: 5


.. TIP::

  Auto-scaling in AWS is based off the CloudWatch service. Configuring auto-scaling can be a bit daunting at first if you haven't used CloudWatch metrics or alarms. 
  
  See the below :ref:`ecs-example-handel-files` section for some examples of configuring auto-scaling.

.. NOTE::

  If you don't wish to configure auto scaling for your containers, just set `min_tasks` = `max_tasks` and don't configure any *scaling_policies*.

.. _ecs-cluster:

Cluster
~~~~~~~
The `cluster` section is defined by the following schema:

.. code-block:: yaml
    
    cluster:
      key_name: <string> # Optional. The name of the EC2 keypair to use for SSH access. Default: none
      instance_type: <string> # Optional. The type of EC2 instances to use in the cluster. Default: t2.micro

.. _ecs-loadbalancer:

LoadBalancer
~~~~~~~~~~~~
The `load_balancer` section is defined by the following schema:

.. code-block:: yaml
    
    load_balancer:
      type: <string> # Required. Allowed values: `http`, `https`. 
      timeout: <integer> # Optional. The connection timeout on the load balancer
      https_certificate: <string> # Required if type=https. The ID of the ACM certificate to use on the load balancer.
      dns_names:
       - <string> # Optional.
      health_check_grace_period: <integer> # Optional. Default: 15. The period of time, in seconds, that the Amazon ECS service scheduler ignores unhealthy Elastic Load Balancing target health checks after a task has first started.

The `dns_names` section creates one or more dns names that point to this load balancer. See :ref:`route53zone-records` for more.

.. _ecs-logging:

Logging
~~~~~~~
If logging is enabled, a CloudWatch log group will be created, with a name like ecs/<appName>-<environmentName>-<serviceName>.
Each container in the container configuration will have a log prefix matching its name. The retention time for the log
group is set with `log_retention_in_days`, and defaults to keeping the logs indefinitely.

.. _ecs-secrets:

Secret Injection
~~~~~~~~~~~~~~~~
By default, the ECS service will inject any parameter store parameters created by your declared dependencies using
the ECS support for `injecting values from SSM <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/specifying-sensitive-data.html>`_.

This support causes environment variables to be set on your tasks which will contain the decrypted values from SSM Parameter
Store.

For example, if your ECS service depends on an Aurora Serverless database, like in the following Handel file (abridged
for clarity):

.. code-block:: yaml

    environments:
      dev:
        my-db:
          type: aurora-serverless
          # other aurora serverless settings
        my-app:
          type: ecs
          dependencies:
            - database
          # Other ecs settings, including container configs

The Aurora Serverless service will create two parameters in Parameter Store: `/<app name>/<env name>/my-db/db_username` and `/<app name>/<env name>/my-db/db_password`.
The ECS deployer will look for any parameters with the prefix `/<app name>/<env name>/my-db/` and will cause the values to be
injected into environment variables named `MY_DB_DB_USERNAME` and `MY_DB_DB_PASSWORD` (following the pattern `<dependency name>_<SSM parameter name>`.

You can also add custom secrets to containers in your task. In each container configuration, you can add a `secrets` key:

.. code-block:: yaml

    environments:
      dev:
        my-app:
          type: ecs
          containers:
            - name: mywebapp
              secrets:
                MY_APP_SECRET: # Name of the environment variable in which to inject the value
                  app: my-secret # Will load the secret from /<app name>/<env name/my-secret
                MY_GLOBAL_SECRET: # Name of the environment variable in which to inject the value
                  global: my-secret # Will load the secret from /handel/global/my-secret
              # Other container settings

If the secret value uses the `app:` key, the secret will be resolved relative to the app-specific prefix, as described
in :ref:`accessing-secrets-application`. If it uses the `global:` key, the secret will be resolved relative to the
`/handel/global/` prefix, as described in :ref:`accessing-secrets-global`.

If you specify a custom secret with the same environment variable name as one from a dependency, the custom secret will
replace the auto-injected dependency secret.

.. _ecs-example-handel-files:

Example Handel Files
--------------------
Simplest Possible ECS Service
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
This Handel file shows an ECS service with only the required parameters:

.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: ecs
          auto_scaling:
            min_tasks: 1
            max_tasks: 1
          containers:
          - name: mywebapp

Web Service
~~~~~~~~~~~
This Handel file shows an ECS service configured with HTTP routing to it via a load balancer:

.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: ecs
          auto_scaling:
            min_tasks: 1
            max_tasks: 1
          load_balancer:
            type: http
          containers:
          - name: mywebapp
            port_mappings:
            - 5000
            routing:
              base_path: /mypath
              health_check_path: /

Multiple Containers
~~~~~~~~~~~~~~~~~~~
This Handel file shows an ECS service with two containers being configured:

.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: ecs
          cluster:
            key_name: mykey
          auto_scaling:
            min_tasks: 1
            max_tasks: 1
          load_balancer:
            type: http
            timeout: 120
          tags:
            mytag: myvalue
          containers:
          - name: mywebapp
            port_mappings:
            - 5000
            max_mb: 256
            cpu_units: 200
            environment_variables:
              MY_VAR: myvalue
            routing:
              base_path: /mypath
              health_check_path: /
          - name: myothercontainer
            max_mb: 256

Auto-Scaling On Service CPU Utilization
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
This Handel file shows an ECS service auto-scaling on its own CPU Utilization metric. Note that in the *alarm* section you can leave off things like *namespace* and *dimensions* and it will default to your ECS service for those values:

.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: ecs
          auto_scaling:
            min_tasks: 1
            max_tasks: 11
            scaling_policies:
            - type: up
              adjustment:
                value: 5
              alarm:
                metric_name: CPUUtilization
                comparison_operator: GreaterThanThreshold
                threshold: 70
            - type: down
              adjustment:
                value: 5
              alarm:
                metric_name: CPUUtilization
                comparison_operator: LessThanThreshold
                threshold: 30
          load_balancer:
            type: http
          containers:
          - name: ecstest
            port_mappings:
            - 5000
            routing:
              base_path: /mypath

Auto-Scaling On Queue Size
~~~~~~~~~~~~~~~~~~~~~~~~~~
This Handel file shows an ECS service scaling off the size of a queue it consumes:

.. code-block:: yaml

    version: 1

    name: my-ecs-app

    environments:
      dev:
        webapp:
          type: ecs
          auto_scaling:
            min_tasks: 1
            max_tasks: 11
            scaling_policies:
            - type: up
              adjustment:
                value: 5
              alarm:
                namespace: AWS/SQS
                dimensions:
                  QueueName: my-ecs-app-dev-queue-sqs
                metric_name: ApproximateNumberOfMessagesVisible
                comparison_operator: GreaterThanThreshold
                threshold: 2000
            - type: down
              adjustment:
                value: 5
              alarm:
                namespace: AWS/SQS
                dimensions:
                  QueueName: my-ecs-app-dev-queue-sqs
                metric_name: ApproximateNumberOfMessagesVisible
                comparison_operator: LessThanThreshold
                threshold: 100
          load_balancer:
            type: http
          containers:
          - name: ecstest
            port_mappings:
            - 5000
            routing:
              base_path: /mypath
          dependencies:
          - queue
        queue:
          type: sqs

        
Depending on this service
-------------------------
The ECS service cannot be referenced as a dependency for another Handel service

Events produced by this service
-------------------------------
The ECS service does not produce events for other Handel services to consume.

Events consumed by this service
-------------------------------
The ECS service does not consume events from other Handel services.
