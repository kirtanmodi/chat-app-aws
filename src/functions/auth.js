const AWS = require("aws-sdk");
const { corsConfig } = require("../helpers");

AWS.config.update({ region: process.env.AWS_REGION || "us-east-1" });

const cognito = new AWS.CognitoIdentityServiceProvider();

exports.register = async (event) => {
  try {
    const { email, name, password } = JSON.parse(event.body);

    if (!email || !name || !password) {
      return {
        statusCode: 400,
        headers: corsConfig.headers,
        body: JSON.stringify({ error: "Please provide all email, name, and password." }),
      };
    }

    const attributeList = [
      {
        Name: "email",
        Value: email,
      },
      {
        Name: "name",
        Value: name,
      },
    ];

    const signUpResponse = await cognito
      .signUp({
        ClientId: process.env.USER_POOL_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: attributeList,
      })
      .promise();

    return {
      statusCode: 200,
      headers: corsConfig.headers,
      body: JSON.stringify(signUpResponse),
    };
  } catch (error) {
    console.error("Error in registering user:", JSON.stringify(error));
    return {
      statusCode: error.statusCode || 500,
      headers: corsConfig.headers,
      body: JSON.stringify({ error: error.message || "An unexpected error occurred." }),
    };
  }
};

exports.confirmRegistration = async (event) => {
  try {
    const { email, verificationCode } = JSON.parse(event.body);

    const confirmSignUpResponse = await cognito
      .confirmSignUp({
        ClientId: process.env.USER_POOL_CLIENT_ID,
        Username: email,
        ConfirmationCode: verificationCode,
      })
      .promise();

    return {
      statusCode: 200,
      headers: corsConfig.headers,
      body: JSON.stringify({ message: "User confirmed successfully." }),
    };
  } catch (error) {
    console.error("Error confirming registration:", JSON.stringify(error));
    return {
      statusCode: error.statusCode || 500,
      headers: corsConfig.headers,
      body: JSON.stringify({ error: error.message || "An unexpected error occurred during confirmation." }),
    };
  }
};

exports.login = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    const user = await cognito
      .adminInitiateAuth({
        UserPoolId: process.env.USER_POOL_ID,
        ClientId: process.env.USER_POOL_CLIENT_ID,
        AuthFlow: "ADMIN_NO_SRP_AUTH",
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })
      .promise();

    return {
      statusCode: 200,
      headers: corsConfig.headers,
      body: JSON.stringify(user),
    };
  } catch (error) {
    console.log("login error", JSON.stringify(error));
    return {
      statusCode: 500,
      headers: corsConfig.headers,
      body: JSON.stringify(error),
    };
  }
};

exports.changePassword = async (event) => {
  try {
    const { email, newPassword } = JSON.parse(event.body);

    const response = await cognito
      .adminSetUserPassword({
        UserPoolId: process.env.USER_POOL_ID,
        Username: email,
        Password: newPassword,
        Permanent: true,
      })
      .promise();

    return {
      statusCode: 200,
      headers: corsConfig.headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in changing password:", JSON.stringify(error));
    return {
      statusCode: error.statusCode || 500,
      headers: corsConfig.headers,
      body: JSON.stringify({ error: error.message || "An unexpected error occurred." }),
    };
  }
};
