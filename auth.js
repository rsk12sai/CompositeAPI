const axios = require("axios");
require("dotenv").config();

/**
 * Salesforce Authentication
 *
 * Uses OAuth 2.0 Client Credentials Flow
 * to retrieve the Salesforce access token
 * and instance URL.
 */
async function getSalesforceToken() {

  const tokenUrl =
    `${process.env.SF_LOGIN_URL}/services/oauth2/token`;

  const params = new URLSearchParams();

  params.append(
    "grant_type",
    "client_credentials"
  );

  params.append(
    "client_id",
    process.env.SF_CLIENT_ID
  );

  params.append(
    "client_secret",
    process.env.SF_CLIENT_SECRET
  );

  const response = await axios.post(
    tokenUrl,
    params.toString(),
    {
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      }
    }
  );

  return {
    accessToken:
      response.data.access_token,

    instanceUrl:
      response.data.instance_url
  };
}

module.exports = {
  getSalesforceToken
};