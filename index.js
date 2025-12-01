/* -----------------------------------------------------------------------------------
---------- IMPORTS, INITIALIZING ENVIRONMENT VARIABLES, DATABASE CONNECTION ----------
------------------------------------------------------------------------------------*/

require('dotenv').config();

// Setting up express variable
const express = require("express");

// Setting up session variable
const session = require("express-session");

// Setting up path variable
let path = require("path");

// Setting up multer variable for image handling
// const multer = require("multer"); ----- UNCOMMENT IF NEEDED -----

// Allows reading body of incoming HTTP requests and makes that data available on req.body
let bodyParser = require("body-parser");

// Set up express object
let app = express();

// Use EJS for the web pages
app.set("view engine", "ejs");

// ----- UNCOMMENT MULTER STUFF IF NEEDED -----
/*
// Root directory for static images
const uploadRoot = path.join(__dirname, "images");
// Sub-directory where uploaded profile pictures will be stored
const uploadDir = path.join(uploadRoot, "uploads");

const storage = multer.diskStorage({
    // Save files into our uploads directory
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    // Reuse the original filename so users see familiar names
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
// Create the Multer instance that will handle single-file uploads
const upload = multer({ storage });

// Expose everything in /images (including uploads) as static assets
app.use("/images", express.static(uploadRoot));
*/

// process.env.PORT is when you deploy and 3000 is for test
const port = process.env.PORT || 3000;

// Setting up session middleware
app.use(
    session(
        {
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
        }
    )
);

// Set up database connection
const knex = require("knex")({
    client: "pg",
    connection: {
        host : process.env.DB_HOST || "localhost",
        user : process.env.DB_USER || "postgres",
        password : process.env.DB_PASSWORD || "admin",
        database : process.env.DB_NAME || "!!!!CHANGE ME !!!!", // ----- CHANGE TO DATABASE NAME -----
        port : process.env.DB_PORT || 5432  // PostgreSQL 16 typically uses port 5434
    }
});

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
// ----- WE WILL MODIFY THIS TO PROTECT THE APPROPRIATE ROUTES -----
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (req.path === '/' || req.path === '/login' || req.path === '/logout') {
        //continue with the request path
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn) {
        next(); // User is logged in, continue
    } 
    else {
        res.render("login", { error_message: "Please log in to access this page" });
    }
});

/* --------------------------------
------------ GET ROUTES -----------
----------------------------------*/

// Logout route
app.get("/logout", (req, res) => {
    // Get rid of the session object
    req.session.destroy((err) => {
        if (err) {
            console.log(err);
        }
        res.redirect("/");
    });
});


/* --------------------------------
----------- POST ROUTES -----------
----------------------------------*/

app.post("/login", (req, res) => {
    let username = req.body.username;
    let password = req.body.password;

    knex.select("username", "password")
        .from('users')
        .where("username", username)
        .andWhere("password", password)
        .then(users => {
            // Check if a user was found with matching username AND password
            if (users.length > 0) {
                req.session.isLoggedIn = true;
                req.session.username = username;
                res.redirect("/");
            } else {
                // No matching user found
                res.render("login", { error_message: "Invalid login" });
            }
        })
        .catch(err => {
            console.error("Login error:", err);
            res.render("login", { error_message: "Invalid login" });
        });
});


/* --------------------------------
---------- DELETE ROUTES ----------
----------------------------------*/



/* ---------------------------------------------------------
---------- SET UP SERVER TO LISTEN ON DESIRED PORT ---------
----------------------------------------------------------*/
app.listen(port, () => {
    console.log("The server is listening");
});