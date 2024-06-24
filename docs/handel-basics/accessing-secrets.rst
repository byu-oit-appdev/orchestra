.. _accessing-secrets:

Accessing Application Secrets
=============================
Many applications have a need to securely store and access *secrets*. These secrets include things like database passwords, encryption keys, etc. This page contains information about how you can store and access these secrets in your application when using Handel.

.. WARNING::

    **Do not** pass these secrets into your application as environment variables in your Handel file. Since you commit your Handel file to source control, any credentials you put in there would be compromised to anyone who can see your source code.
    
    Handel provides a different mechanism for passing secrets to your application, as explained in this document.

.. _accessing-secrets-application:

Application Secrets in Handel
-----------------------------
Handel uses the `EC2 Systems Manager Parameter Store <https://aws.amazon.com/ec2/systems-manager/parameter-store/>`_ for secrets storage. This service provides a key/value store where you can securely store secrets in a named parameter. You can then call the AWS API from your application to obtain these secrets.

Handel automatically wires up access to the Parameter Store in your applications, granting you access to get parameters whose names start with a particular path. Handel wires up permissions for parameters with the following path:

.. code-block:: none

    /<appName>/<environmentName>/

To see a concrete illustration of this, consider the following example Handel file, which defines a single Lambda:

.. code-block:: yaml

    version: 1

    name: my-lambda-app

    environments:
      dev:
        function:
          type: lambda
          path_to_code: .
          handler: app.handler
          runtime: nodejs12.x

This Lambda, when deployed, will be able to access any EC2 Parameter Store parameters under the path "/my-lambda-app/dev/". Thus, the parameter ``/my-lambda-app/dev/somesecret`` would be available to this application, but the ``/some-other-app/dev/somesecret`` parameter would not, because it is not included in the same path.

.. NOTE::

    As a convenience, Handel injects an environment variable called ``HANDEL_PARAMETER_STORE_PATH`` into your application. This variable contains the pre-built ``/<appName>/<environmentName>/`` path so that you don't have to build it yourself.

.. WARNING::

    Previously Handel wired permissions based on a prefix like: ``<appName>.<environmentName>`` This functionality is being deprecated in favor of paths. As a convenience, Handel still wires the permissions and injects an environment variable called ``HANDEL_PARAMETER_STORE_PREFIX`` into your application. This variable contains the pre-built ``<appName>.<environmentName>`` prefix so that you don't have to build it yourself. Please only use prefix if required. Otherwise Path is preferred. More info can be found `Here <https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-organize.html>`_

    Any Handel services which add secrets to Parameter Store will, by default, create both path- and dot-style parameters.

.. _accessing-secrets-global:

Global Parameters
~~~~~~~~~~~~~~~~~
It is a common desire to share some parameters globally with all apps living in an account. To support this, Handel also grants your application permission to access a special global namespace of parameters that start with the following prefix:

.. code-block:: none

    handel.global

Parameters that start with this prefix are available to any app deployed using Handel in the account and region that you're running in.

.. WARNING::

    Any parameter you put here WILL be available to any other user of Handel in the account. Don't put secrets in this namespace that belong to just your app!

Adding a Parameter to the Parameter Store
-----------------------------------------
See the `Walkthrough <http://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-walk.html>`_ in the AWS documentation for an example of how to add your parameters.

.. IMPORTANT:: 

    When you add your parameter, remember to start the name of the parameter with your application name from your Handel file.

Getting Parameters from the Parameter Store
-------------------------------------------
Once you've added a parameter to the Parameter Store with the proper prefix, your deployed application should be able to access it. See the example of CLI access for the get-parameters call in the `Walkthrough <http://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-walk.html>`_ for information on how to do this.

The example in the walkthrough shows an example using the CLI, but you can use the AWS language SDKs with the getParameters call in a similar manner. See the documentation of the SDK you are using for examples.
