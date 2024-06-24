.. _aurora:

Aurora Serverless
=================
This page contains information about using the Aurora Serverless service in Handel. This service provides a "serverless" instance of Aurora (MySQL).

.. WARNING::

    Aurora Serverless is not appropriate for all workloads. Review the `Use Cases <https://aws.amazon.com/rds/aurora/serverless/#Use_Cases>`_ before choosing this service.

Service Limitations
-------------------

No Option Group Support
~~~~~~~~~~~~~~~~~~~~~~~
This service doesn't allow you to specify any custom options in an option group. It does allow you specify custom parameters in a parameter group, however.

No Update Support
~~~~~~~~~~~~~~~~~
This service intentionally does not support updates. Once a database is created, certain updates to the database will cause a new database to be created and the old one deleted. In an effort to avoid unwanted data loss, we don't update this service automatically. You can still modify the database and parameter group manually in the AWS console.

.. WARNING::

    Make sure you know what you're doing when you modify your RDS database in the AWS Console. Certain actions will cause database downtime, and some may even cause the database to be recreated.

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
     - This must always be *aurora-serverless* for this service type.
   * - engine
     - string
     - Yes
     -
     - The Aurora engine you wish to use. Allowed values: 'mysql'
   * - version
     - string
     - Yes
     - 
     - The version of MySQL you wish to run. Allowed values for MySQL: '5.6.10a'
   * - database_name
     - string
     - Yes
     - 
     - The name of your database in your Aurora cluster.
   * - description
     - string
     - No
     - 
     - The description on the resources created for the cluster
   * - scaling
     - :ref:`aurora-serverless-scaling`
     - No
     -
     - Cluster capacity scaling configuration
   * - cluster_parameters
     - map<string, string>
     - No
     - 
     - A list of key/value Aurora cluster parameter group pairs to configure your cluster. You will need to look in the AWS Console to see the list of available cluster parameters for Aurora.
   * - tags
     - :ref:`tagging-resources`
     - No
     - 
     - Any tags you wish to apply to this Aurora instance.


.. _aurora-serverless-scaling:

Scaling Configuration
~~~~~~~~~~~~~~~~~~~~~

The `scaling` section is defined by the following schema:

.. list-table::
   :header-rows: 1

   * - Parameter
     - Type
     - Required
     - Default
     - Description
   * - auto_pause
     - boolean
     - No
     - true
     - Whether to automatically pause this database if it has been idle for a specified time.
   * - seconds_until_auto_pause
     - number
     - No
     - `300` (5 minutes)
     - How long the database must be idle before it can be paused.
   * - min_capacity
     - One of `2`, `4`, `8`, `16`, `32`, `64`, `128`, or `256`
     - No
     - `2`
     - The minimum capacity (in Aurora Compute Units)
   * - max_capacity
     - One of `2`, `4`, `8`, `16`, `32`, `64`, `128`, or `256`
     - No
     - `64`
     - The maximum capacity (in Aurora Compute Units)


Example Handel File
-------------------

.. code-block:: yaml

    version: 1

    name: aurora-serverless-test

    environments:
      dev:
        database:
            type: aurora-serverless
            engine: mysql
            version: 5.6.10a
            database_name: MyDb
            scaling:
                min_capacity: 2
                max_capacity: 16
                auto_pause: true
                seconds_until_auto_pause: 600 # 10 minutes
            cluster_parameters: # This is where you can set parameters that configure the cluster as a whole
                character_set_database: utf8mb4
            tags:
                some: tag

Depending on this service
-------------------------
The Aurora Serverless service outputs the following environment variables:

.. list-table::
   :header-rows: 1

   * - Environment Variable
     - Description
   * - <SERVICE_NAME>_CLUSTER_ENDPOINT
     - The address that you should use for writes to the database.
   * - <SERVICE_NAME>_READ_ENDPOINT
     - The address that you should use for reads to the database.
   * - <SERVICE_NAME>_PORT
     - The port on which the Aurora cluster instances are listening.
   * - <SERVICE_NAME>_DATABASE_NAME
     - The name of the database in your Aurora cluster.

See :ref:`environment-variable-names` for information about how the service name is included in the environment variable name.

In addition, the Aurora service puts the following credentials into the EC2 parameter store:

.. list-table::
   :header-rows: 1

   * - Parameter Name 
     - Description
   * - /<parameter_prefix>/<service_name>/db_username
     - The username for your database user.
   * - /<parameter_prefix>/<service_name>/db_password
     - The password for your database user.

.. NOTE::

  The <parameter_prefix> section of the parameter name is a consistent prefix applied to all parameters injected by services in the EC2 Parameter Store. See :ref:`parameter-store-prefix` for information about the structure of this prefix.

  The <service_name> section of the parameter name should be replaced by the :ref:`service name <handel-file-explanation>` you gave your database in your Handel file.

.. NOTE::

  Aurora Serverless does not actually differentiate between read endpoints and write endpoints, like Aurora does. However, a common use case for Aurora Serverless is to run non-production workloads and to run the production workloads using provisioned Aurora. In order to make this use case simpler, the Aurora-Serverless Handel service mimics the variables set by the provisioned Aurora service.

Events produced by this service
-------------------------------
The Aurora service does not produce events for other Handel services to consume.

Events consumed by this service
-------------------------------
The Aurora service does not consume events from other Handel services.
