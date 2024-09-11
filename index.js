const express = require("express");
const axios = require("axios");
const { connectionToDB } = require("./config/db");
require("dotenv").config();
const querystring = require("querystring");
const { User } = require("./modals/UserInfo.modals");

const app = express();
const port = 3000;

// In-memory store for users (Replace with a real database in production)
const users = {};
let access_token_one;
let linear_token_one;

// Middleware to parse JSON bodies (for handling POST requests)
app.use(express.json());

app.get("/", async (req, res) => {
  res.send("home page for slack");
});

// Route to handle Slack OAuth redirect
app.get("/slack/oauth_redirect", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code is missing");
  }
  console.log(code, "code I have here!!!");
  try {
    // Exchange the authorization code for an access token
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      null,
      {
        params: {
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          code: code,
          redirect_uri: process.env.SLACK_REDIRECT_URI,
        },
      }
    );

    const { access_token, authed_user, team } = response.data;
    access_token_one = response.data.access_oken;
    console.log(response, "response data coming after hit this api");
    if (!access_token) {
      return res.status(400).send("Failed to obtain access token");
    }

    // Store user information in memory (replace with a database in production)
    users[authed_user.id] = {
      access_token,
      team_id: team.id,
      user_id: authed_user.id,
    };

    // Send a success response
    res.send("Authorization successful! You can now close this window.");
  } catch (error) {
    console.error("Error exchanging code for access token:", error);
    res.status(500).send("An error occurred during the authorization process");
  }
});

// Route to send a message to a Slack user
app.post("/send-message", async (req, res) => {
  const { userId, message } = req.body;

  // const user = users[userId];
  // if (!user) {
  //   return res.status(404).send("User not found");
  // }

  try {
    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: userId,
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${access_token_one}`,
        },
      }
    );

    res.send("Message sent successfully");
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Failed to send message");
  }
});

// Linear backedn integration

app.get("/auth/linear", (req, res) => {
  const authUrl = "https://linear.app/oauth/authorize";
  const params = querystring.stringify({
    client_id: process.env.LINEAR_CLIENT_ID,
    redirect_uri: process.env.LINEAR_REDIRECT_URI,
    response_type: "code",
    scope: "read write",
  });
  console.log(authUrl, "auth Url ");
  console.log(params, "params");
  // Redirect the user to Linear's authorization page
  res.redirect(`${authUrl}?${params}`);
});

// Step 2: Callback URL to capture authorization code
app.get("/callback/auth/linear", async (req, res) => {
  const { code } = req.query;
  console.log(code, "getting code ");

  if (!code) {
    return res.status(400).send("Authorization code missing.");
  }

  try {
    // Step 3: Exchange authorization code for access token
    const tokenUrl = "https://api.linear.app/oauth/token";
    const tokenData = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.LINEAR_REDIRECT_URI,
      client_id: process.env.LINEAR_CLIENT_ID,
      client_secret: process.env.LINEAR_CLIENT_SECRET,
    };

    const tokenResponse = await axios.post(
      tokenUrl,
      querystring.stringify(tokenData),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    console.log(tokenResponse.data, "response from the token URL");
    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = tokenResponse.data;

    console.log(accessToken, "access token coming ");

    // // Fetch user info from Linear API
    // const userInfoResponse = await axios.post(
    //   "https://api.linear.app/graphql",
    //   {
    //     query: `
    //       query {
    //         viewer {
    //           id
    //           name
    //           email
    //           avatarUrl
    //           teams {
    //             id
    //             name
    //           }
    //         }
    //       }
    //     `,
    //   },
    //   {
    //     headers: {
    //       Authorization: `Bearer ${accessToken}`,
    //       "Content-Type": "application/json",
    //     },
    //   }
    // );

    // console.log(userInfoResponse.data, "Received user info from Linear");

    // const userInfo = userInfoResponse.data.data.viewer;
    // if (!userInfo) {
    //   throw new Error("User info is missing from the Linear API response");
    // }

    // const { id: linearUserId, email, name, avatarUrl, teams } = userInfo;

    // // Calculate token expiration date
    // const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // // Store user info and tokens in the database
    // const user = await User.findOneAndUpdate(
    //   { linearUserId }, // Search by Linear user ID
    //   {
    //     linearUserId,
    //     accessToken,
    //     refreshToken,
    //     tokenExpiresAt,
    //     email,
    //     name,
    //     avatarUrl: avatarUrl || null,
    //     organizationId: teams.length > 0 ? teams[0].id : null, // Assuming the first team is the main team
    //     provider: "linear",
    //   },
    //   { upsert: true, new: true }
    // );
    // console.log(user, "user info in the data base");
    res.send(`User info stored for ${accessToken}`);
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.status(500).send("Failed to authenticate user.");
  }
});

// Assuming you have a User model

// app.get("/callback/auth/linear", async (req, res) => {
//   const { code } = req.query;

//   if (!code) {
//     return res.status(400).send("Authorization code missing.");
//   }

//   try {
//     // Step 3: Exchange authorization code for access token
//     const tokenUrl = "https://api.linear.app/oauth/token";
//     const tokenData = {
//       grant_type: "authorization_code",
//       code: code,
//       redirect_uri: process.env.LINEAR_REDIRECT_URI,
//       client_id: process.env.LINEAR_CLIENT_ID,
//       client_secret: process.env.LINEAR_CLIENT_SECRET,
//     };

//     const tokenResponse = await axios.post(
//       tokenUrl,
//       querystring.stringify(tokenData),
//       {
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       }
//     );
//     console.log(tokenResponse, "token respone from the autheticated url ");
//     const { access_token, refresh_token, expires_in } = tokenResponse.data;
//     linear_token_one = tokenResponse.data.access_token;
//     console.log(
//       `${access_token} acces token ${refresh_token} refresh token ${expires_in} expiry for token`
//     );
//     // Fetch user info from Linear API

//     const userInfoResponse = await axios.get("https://api.linear.app/me", {
//       headers: {
//         Authorization: `Bearer ${access_token}`,
//       },
//     });

//     console.log(userInfoResponse, "user information linear");

//     const userInfo = userInfoResponse.data;
//     console.log(userInfo, "coming from the lienar user info");
//     const { id: linearUserId, email, name, avatarUrl, team } = userInfo;

//     // Store user info and tokens in the database
//     const user = await User.findOneAndUpdate(
//       { linearUserId }, // Search by Linear user ID
//       {
//         linearUserId,
//         accessToken: access_token,
//         refreshToken: null,
//         tokenExpiresAt,
//         email,
//         name,
//         avatarUrl: avatarUrl || null,
//         organizationId: team ? team.id : null,
//         provider: "linear",
//       },
//       { upsert: true, new: true }
//     );

//     res.send(`User info stored for ${user.name}`);
//   } catch (error) {
//     console.error("Error during OAuth callback:", error);
//     res.status(500).send("Failed to authenticate user.");
//   }
// });

// Start the Express server
app.listen(port, async () => {
  try {
    await connectionToDB
      .then((res) => console.log("Mongo db is connected"))
      .catch((error) => console.log("Mongo db have problem", error));
    console.log(`server is running on port 3000`);
  } catch (error) {
    console.log(error, "error");
  }
});
