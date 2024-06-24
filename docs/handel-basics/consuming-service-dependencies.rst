.. _consuming-service-dependencies:

Consuming Service Dependencies
==============================
When you specify a dependency on a service using :ref:`service-dependencies`, that service is auto-wired to your application. This page contains information about how you can consume those injected dependencies in your application code to actually communicate with these services.

When Handel wires services together securely, it will inject environment variables into the consuming service for each service that it depends on. These environment variables provide information about the created service that tell you information such as where to find the service and how to communicate with it. 

The following Handel file defines a Beanstalk service that depends on an SQS queue:

.. code-block:: yaml

    version: 1

    name: beanstalk-example

    environments:
      dev:
        webapp:
          type: beanstalk
          path_to_code: .
          solution_stack: 64bit Amazon Linux 2016.09 v4.0.1 running Node.js
          instance_type: t2.micro
          health_check_url: /
          min_instances: 1
          max_instances: 1
          dependencies:
          - my-queue
        my-queue:
          type: sqs

Handel will inject environment variables in the Beanstalk application for the SQS queue, such as the queue's ARN, name, and URL. You can read these environment variables when you are writing code to communicate with the queue.

.. _environment-variable-names:

Environment Variable Names
--------------------------
Every environment variable injected by Handel for service dependencies has a common structure.

This environment variable name consists of the dependency's name (as defined in the Handel file), followed by the name of the value being injected.

.. code-block:: none

   <SERVICE_NAME>_<VALUE_NAME>

In the above example, the referencing Beanstalk application would need to use the following name to get the URL of the SQS Queue:

.. code-block:: none

    MY_QUEUE_QUEUE_URL

.. NOTE::
   All Handel injected environment variables will be all upper-cased, with dashes converted to underscores.
   
.. _parameter-store-prefix:

Parameter Store Prefix
----------------------
Handel puts auto-generated credentials and other secrets in the EC2 Parameter Store, and it wires up your applications to allow you to access these secrets.

Each parameter Handel puts in the parameter store has a common prefix, which is defined by the following structure:

.. code-block:: none

    /<app_name>/<environment_name>/

You can use the :ref:`consuming-service-dependencies-common-vars` to obtain the value of this prefix.

.. WARNING::

    Previously Handel wired permissions based on a prefix like: ``<appName>.<environmentName>`` This functionality is being deprecated in favor of paths. As a convenience, Handel still wires the permissions and injects an environment variable called ``HANDEL_PARAMETER_STORE_PREFIX`` into your application. This variable contains the pre-built ``<appName>.<environmentName>`` prefix so that you don't have to build it yourself. Please only use prefix if required. Otherwise Path is preferred. More info can be found `Here <https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-organize.html>`_

    Any Handel services which add secrets to Parameter Store will, by default, create both path- and dot-style parameters.


.. _consuming-service-dependencies-common-vars:

Common Injected Environment Variables
-------------------------------------
In addition to environment variables injected by services your applications consume, Handel will inject a common set of environment variables to all applications:

.. list-table::
   :header-rows: 1
   
   * - Environment Variable
     - Description
   * - HANDEL_APP_NAME
     - This is the value of the *name* field from your Handel file. It is the name of your application.
   * - HANDEL_ENVIRONMENT_NAME
     - This is the value of the *\<environment\>* field from your Handel file. It is the name of the environment the current service is a part of.
   * - HANDEL_SERVICE_NAME
     - This is the value of the *\<service_name>* field from your Handel file. It is the name of the currently deployed service.
   * - HANDEL_PARAMETER_STORE_PATH
     - This is the :ref:`prefix <parameter-store-prefix>` used for secrets stored in Parameter Store.
   * - HANDEL_PARAMETER_STORE_PREFIX
     - Deprecated. This is an old form of the :ref:`prefix <parameter-store-prefix>` used for secrets stored in Parameter Store.
   * - HANDEL_REGION_NAME
     - This is the value of the *<region_name>* field from your Handel file, or the current region if the region id not specified.