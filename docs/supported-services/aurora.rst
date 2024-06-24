.. _aurora:

Aurora (RDS)
============
This page contains information about using the Aurora service in Handel. This service provides an Aurora cluster (MySQL or PostgreSQL) via the RDS service.

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
     - This must always be *aurora* for this service type.
   * - engine
     - string
     - Yes
     - 
     - The Aurora engine you wish to use. Allowed values: 'mysql', 'postgresql'
   * - version
     - string
     - Yes
     - 
     - The version of MySQL or PostgreSQL you wish to run. Allowed values for MySQL: '5.7.12'. Allowed values for PostgreSQL: '9.6.3'.
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
   * - instance_type
     - string
     - No
     - db.t2.small for MySQL, db.r4.large for PostgreSQL.
     - The size of database instance to run. Not all database instance types are supported for Aurora.
   * - cluster_size
     - number
     - No
     - 1
     - The number of instances (including the primary) to run in your cluster.
   * - cluster_parameters
     - map<string, string>
     - No
     - 
     - A list of key/value Aurora cluster parameter group pairs to configure your cluster. You will need to look in the AWS Console to see the list of available cluster parameters for Aurora.
   * - instance_parameters
     - map<string, string>
     - No
     - 
     - A list of key/value Aurora instance parameter group pairs to configure the instances in your cluster. You will need to look in the AWS Console to see the list of available instance parameters for Aurora.
   * - tags
     - :ref:`tagging-resources`
     - No
     - 
     - Any tags you wish to apply to this Aurora instance.
     
.. WARNING::

    Be aware that Aurora clusters can be very expensive. A cluster with 3 *db.r4.2xlarge* instances in it will cost about about $2,500/month. Make sure you check how much you will be paying!

    You can use the excellent `EC2Instances.info <http://www.ec2instances.info/rds/>`_ site to easily see pricing information for RDS databases. Remember that you pay the full price for each instance in your cluster.


Example Handel File
-------------------

.. code-block:: yaml

    version: 1

    name: aurora-test

    environments:
      dev:
        database:
            type: aurora
            engine: mysql
            version: 5.7.12
            database_name: MyDb
            instance_type: db.t2.medium
            cluster_size: 3
            cluster_parameters: # This is where you can set parameters that configure the cluster as a whole
                character_set_database: utf8mb4
            instance_parameters: # This is where you can set parameters that apply to each instance.
                autocommit: 1
            tags:
                some: tag

Depending on this service
-------------------------
The Aurora service outputs the following environment variables:

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

Events produced by this service
-------------------------------
The Aurora service does not produce events for other Handel services to consume.

Events consumed by this service
-------------------------------
The Aurora service does not consume events from other Handel services.
