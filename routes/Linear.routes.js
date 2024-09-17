const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const { LinearUser } = require("../modals/LinearUser.modals");
const linearRoutes = express.Router();
const dotenv = require("dotenv");
dotenv.config();
const { LinearClient } = require("@linear/sdk");
const { LinearUserTask } = require("../modals/LinearTask.modals");

linearRoutes.get("/auth/linear", (req, res) => {
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
linearRoutes.get("/callback/auth/linear", async (req, res) => {
  const { code } = req.query;
  console.log(code, "getting code");

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

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    console.log(tokenResponse.data, "response after authenticating the user");

    const client = new LinearClient({
      accessToken: access_token,
    });
    console.log(client, "client info which is now authenticated");

    const me = await client.viewer;

    // Check if the user already exists in the database
    let linearUser = await LinearUser.findOne({ linearUserId: me.id });

    if (linearUser) {
      // User exists, update their access token and other details
      linearUser.access_token = access_token;
      linearUser.name = me.name;
      linearUser.email = me.email;

      await linearUser.save(); // Save the updated user details

      console.log(linearUser, "updated user");
    } else {
      // User does not exist, create a new user
      linearUser = new LinearUser({
        linearUserId: me.id,
        access_token: access_token,
        name: me.name,
        email: me.email,
      });

      await linearUser.save(); // Save the new user
      console.log(linearUser, "new user");
    }

    res.send("You are authenticated. You can close this window now!");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.status(500).send("Failed to authenticate user.");
  }
});

// Import the task model

linearRoutes.post("/create/task/linear", async (req, res) => {
  const { title, description, email } = req.body;

  // Validate the required fields
  if (!title || !email) {
    return res.status(400).send("Title and email are required.");
  }

  try {
    // Find the user in the Linear database using the email
    const linearUser = await LinearUser.findOne({ email });
    if (!linearUser) {
      return res.status(404).send("User not found in Linear database.");
    }

    const { access_token } = linearUser;

    // Create a new Linear client for this user
    const client = new LinearClient({
      accessToken: access_token,
    });

    // Get the user's teamId (assuming they have access to a team)
    const teams = await client.teams();
    if (!teams || teams.nodes.length === 0) {
      return res.status(400).send("User has no team available.");
    }

    const teamId = teams.nodes[0].id; // You can select the first team or modify this logic

    // Create a new task for the user on Linear
    const response = await axios.post(
      "https://api.linear.app/graphql",
      {
        query: `
          mutation {
            issueCreate(input: {
              title: "${title}",
              description: "${description || ""}",
              teamId: "${teamId}"
            }) {
              success
              issue {
                id
                title
                description
              }
            }
          }
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { data } = response;

    // Check if task creation on Linear was successful
    if (!data || !data.data || !data.data.issueCreate.success) {
      return res.status(500).send("Failed to create task on Linear.");
    }

    // Save the task in your MongoDB database using LinearUserTask model
    const newTask = new LinearUserTask({
      title: data.data.issueCreate.issue.title,
      description: data.data.issueCreate.issue.description,
      email: email, // Store the user email
    });

    await newTask.save(); // Save task to the database

    // Send a response back with the created task
    res.send({
      linearTask: data.data.issueCreate.issue,
      message: "Task successfully created and saved in the database.",
    });
  } catch (error) {
    console.error("Error creating task for user:", error);
    res.status(500).send("Failed to create task for the user.");
  }
});

module.exports = { linearRoutes };
