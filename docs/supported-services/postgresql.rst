.. _postgresql:

PostgreSQL (RDS)
================
This page contains information about using the PostgreSQL service in Handel. This service provides a PostgreSQL database via the RDS service.

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
     - This must always be *postgresql* for this service type.
   * - database_name
     - string
     - Yes
     - 
     - The name of your database in your PostgreSQL instance.
   * - postgres_version
     - string
     - Yes
     - 
     - The version of PostgreSQL you wish to run. See `PostgreSQL on Amazon RDS <http://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html#PostgreSQL.Concepts.General.DBVersions>`_ for the list of supported versions.
   * - description
     - string
     - No
     - Parameter group.
     - The parameter group description.
   * - instance_type
     - string
     - No
     - db.t2.micro
     - The size of database instance to run. See `DB Instance Class <http://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html>`_ for information on choosing an instance type.
   * - storage_gb
     - number
     - No
     - 5
     - The number of Gigabytes (GB) of storage to allocate to your database.
   * - storage_type
     - string
     - No
     - standard
     - The type of storage to use, whether magnetic or SSD. Allowed values: 'standard', 'gp2'.
   * - multi_az
     - boolean
     - No
     - false
     - Whether or not the deployed database should be Multi-AZ. Note: Using Multi-AZ increases the cost of your database.
   * - db_parameters
     - map<string, string>
     - No
     - 
     - A list of key/value PostgreSQL parameter group pairs to configure your database. You will need to look in the AWS Console to see the list of available parameters for PostgreSQL.
   * - tags
     - :ref:`tagging-resources`
     - No
     - 
     - Any tags you wish to apply to this PostgreSQL instance.
     
.. WARNING::

    Be aware that large database instances are very expensive. The *db.cr1.8xl* instance type, for example, costs about $3,400/month. Make sure you check how much you will be paying!

    You can use the excellent `EC2Instances.info <http://www.ec2instances.info/rds/>`_ site to easily see pricing information for RDS databases.

Example Handel File
-------------------

.. code-block:: yaml

    version: 1

    name: my-postgres-instance

    environments:
      dev:
        database:
          type: postgresql
          database_name: mydb
          instance_type: db.t2.micro
          storage_gb: 5
          postgres_version: 9.6.2
          storage_type: standard
          db_parameters:
            authentication_timeout: 600
          tags:
            mytag: myvalue

Depending on this service
-------------------------
The PostgreSQL service outputs the following environment variables:

.. list-table::
   :header-rows: 1

   * - Environment Variable
     - Description
   * - <SERVICE_NAME>_ADDRESS
     - The DNS name of the PostgreSQL database address.
   * - <SERVICE_NAME>_PORT
     - The port on which the PostgreSQL instance is listening.
   * - <SERVICE_NAME>_DATABASE_NAME
     - The name of the database in your PostgreSQL instance.

See :ref:`environment-variable-names` for information about how the service name is included in the environment variable name.

In addition, the PostgreSQL service puts the following credentials into the EC2 parameter store:

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
The PostgreSQL service does not produce events for other Handel services to consume.

Events consumed by this service
-------------------------------
The PostgreSQL service does not consume events from other Handel services.
