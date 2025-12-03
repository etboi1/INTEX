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
const multer = require("multer");

// Allows reading body of incoming HTTP requests and makes that data available on req.body
let bodyParser = require("body-parser");

// Set up express object
let app = express();

// Use EJS for the web pages
app.set("view engine", "ejs");

// ----- UNCOMMENT MULTER STUFF IF NEEDED -----

// Root directory for static images
const logoRoot = path.join(__dirname, "images");

const logoDir = path.join(logoRoot, "logos");
const programDir = path.join(logoRoot, "programs");

// Storage for logos
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, logoDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// Storage for programs
const programStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, programDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// Upload handlers
const uploadLogo = multer({ storage: logoStorage });
const uploadProgram = multer({ storage: programStorage });

// Expose everything in /images (including uploads) as static assets
app.use("/images", express.static(logoRoot));


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
        host : process.env.RDS_HOSTNAME || "localhost",
        user : process.env.RDS_USERNAME || "postgres",
        password : process.env.RDS_PASSWORD || "admin",
        database : process.env.RDS_DB_NAME || "ellarises", // ----- CHANGE TO DATABASE NAME -----
        port : process.env.RDS_PORT || 5432,  // PostgreSQL 16 typically uses port 5434
        ssl : process.env.DB_SSL ? {rejectUnauthorized: false} : false
    }
});

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
// ----- WE WILL MODIFY THIS TO PROTECT THE APPROPRIATE ROUTES -----
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (req.path === '/' || req.path === '/login' || req.path === '/logout' || req.path === '/signup' || '/addSignUp') {
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


app.get("/", (req, res) => {
    res.render("index", {level: req.session.level, login: req.session.isLoggedIn})
})

app.get("/login", (req, res) => {
    res.render("login", { error_message: "Please log in to access this page" })
})

app.get("/signup", (req, res) => {
    res.render("signup", { error_message: "" })
})

app.get("/viewPart", (req, res) => {
    knex.select().from("participant_info").then(parts => {
        res.render("viewPart", {level: req.session.level, parts: parts, error_message: ""})
    })
    .catch(err => {
        console.error("Participant error:", err);
        res.render("viewPart", {level: req.session.level, parts: [], error_message: "Participant Table cannot be found" });
    });
})

app.get("/searchPart", (req, res) => {
    if (req.query.emailSearch === "") {
        return res.redirect("/viewPart");
    }

    knex.select().from("participant_info").where("part_email", req.query.emailSearch).then(parts => {
        res.render("viewPart", {level: req.session.level, parts: parts, error_message: ""})
    })
    .catch(err => {
        console.error("Participant error:", err);
        res.render("viewPart", {level: req.session.level, parts: [], error_message: "Participant Table cannot be found" });
    });
})

app.get("/addPart", (req, res) => {
    if (req.session.level === "m") {
        res.render("addPart", {error_message: ""})
    } else {
        res.redirect("/")
    }
})

app.get("/editPart/:part_id", (req, res) => {
    if (req.session.level === "m") {
        knex.select().from("participant_info").where("part_id", req.params.part_id).first().then(part => {
            if (!part) {
                return res.status(404).render("viewPart", {
                    parts: [],
                    error_message: "Part not found."
                });
            }
            res.render("editPart", {part: part, error_message: ""})
        })
        .catch((err) => {
            console.error("Error fetching part:", err.message);
            res.status(500).render("viewPart", {
                parts: [],
                error_message: "Unable to load participant for editing."
            });
        });
    } else {
        res.redirect("/")
    }
})


                                                                // USERS PAGE

// View all users (master only)
app.get("/viewUsers", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    knex.select().from("users").then(users => {
        res.render("viewUsers", { level: req.session.level, users: users, error_message: "" });
    })
    .catch(err => {
        console.error("Users error:", err);
        res.render("viewUsers", { level: req.session.level, users: [], error_message: "Users table cannot be found" });
    });
});

app.get("/searchUser", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }
    if (req.query.emailSearch === "") {
        return res.redirect("/viewUsers");
    }

    knex.select().from("users").where("email", req.query.emailSearch).then(users => {
        res.render("viewUsers", { level: req.session.level, users: users, error_message: "" });
    })
    .catch(err => {
        console.error("Users error:", err);
        res.render("viewUsers", { level: req.session.level, users: [], error_message: "Users table cannot be found" });
    });
});

// Add user page
app.get("/addUser", (req, res) => {
    if (req.session.level === "m") {
        res.render("addUser", { error_message: "" });
    } else {
        res.redirect("/");
    }
});

// Edit user page
app.get("/editUser/:user_id", (req, res) => {
    if (req.session.level === "m") {
        knex("users")
            .where("user_id", req.params.user_id)
            .first()
            .then(user => {
                if (!user) {
                    return res.status(404).render("viewUsers", {
                        users: [],
                        error_message: "User not found."
                    });
                }
                res.render("editUser", { user: user, error_message: "" });
            })
            .catch(err => {
                console.error("Edit user error:", err);
                res.status(500).render("viewUsers", {
                    users: [],
                    error_message: "Unable to load user for editing."
                });
            });
    } else {
        res.redirect("/");
    }
});


/* --------------------------------
----------- POST ROUTES -----------
----------------------------------*/

app.post("/login", (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    knex.select("email", "password", "level")
        .from('users')
        .where("email", email)
        .andWhere("password", password)
        .then(users => {
            // Check if a user was found with matching username AND password
            if (users.length > 0) {
                req.session.isLoggedIn = true;
                req.session.email = email;
                req.session.level = users[0].level;
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

app.post("/addPart", (req, res) => {

    const {
    part_email,
    part_first_name,
    part_last_name,
    part_dob,
    part_role,
    part_phone,
    part_city,
    part_state,
    part_zip,
    part_school_or_employer,
    total_donations
    } = req.body;

    // Basic validation to ensure required fields are present.
    if (!part_email || !part_first_name || !part_last_name || !part_dob || !part_role || !part_phone || !part_city || !part_state || !part_zip || !part_school_or_employer || !total_donations) {
        return res.status(400).render("addPart", {error_message: "All fields are required." });
    }

    const newPart = {
        part_email,
        part_first_name,
        part_last_name,
        part_dob,
        part_role,
        part_phone,
        part_city,
        part_state,
        part_zip,
        part_school_or_employer,
        total_donations
    };

    // Insert the record into PostgreSQL and return the participant list on success.
    knex("participant_info")
        .insert(newPart)
        .then(() => {
            res.redirect("/viewPart");
        })
        .catch((dbErr) => {
            console.error("Error inserting participant:", dbErr.message);
            // Database error, so show the form again with a generic message.
            res.status(500).render("addPart", {error_message: "Unable to save participant. Please try again." });
        });
});  

app.post("/editPart/:part_id", (req, res) => {
    const partId = req.params.part_id;
    const {
    part_email,
    part_first_name,
    part_last_name,
    part_dob,
    part_role,
    part_phone,
    part_city,
    part_state,
    part_zip,
    part_school_or_employer,
    total_donations
    } = req.body;

    if (!part_email || !part_first_name || !part_last_name || !part_dob || !part_role || !part_phone || !part_city || !part_state || !part_zip || !part_school_or_employer || !total_donations) {
        return knex("participant_info")
            .where({ part_id: partId })
            .first()
            .then((part) => {
                if (!part) {
                    return res.status(404).render("viewPart", {
                        parts: [],
                        error_message: "Participant not found."
                    });
                }

                res.status(400).render("editPart", {
                    part,
                    error_message: "All fields are required."
                });
            })
            .catch((err) => {
                console.error("Error fetching participant:", err.message);
                res.status(500).render("viewPart", {
                    parts: [],
                    error_message: "Unable to load participant for editing."
                });
            });
    }

    const updatedPart = {
        part_email,
        part_first_name,
        part_last_name,
        part_dob,
        part_role,
        part_phone,
        part_city,
        part_state,
        part_zip,
        part_school_or_employer,
        total_donations
    };

    knex("participant_info")
        .where({ part_id: partId })
        .update(updatedPart)
        .then((rowsUpdated) => {
            if (rowsUpdated === 0) {
                return res.status(404).render("viewPart", {
                    parts: [],
                    error_message: "Participant not found."
                });
            }

            res.redirect("/viewPart");
        })
        .catch((err) => {
            console.error("Error updating participant:", err.message);
            knex("participant_info")
                .where({ part_id: partId })
                .first()
                .then((part) => {
                    if (!part) {
                        return res.status(404).render("viewPart", {
                            parts: [],
                            error_message: "Participant not found."
                        });
                    }

                    res.status(500).render("editPart", {
                        part,
                        error_message: "Unable to update participant. Please try again."
                    });
                })
                .catch((fetchErr) => {
                    console.error("Error fetching participant after update failure:", fetchErr.message);
                    res.status(500).render("viewPart", {
                        parts: [],
                        error_message: "Unable to update participant."
                    });
                });
        });
});



                                                            // User Data
// Add user
app.post("/addUser", (req, res) => {
    const { email, password, level } = req.body;

    if (!email || !password || !level) {
        return res.status(400).render("addUser", { error_message: "All fields are required." });
    }

    const newUser = { email, password, level };

    knex("users")
        .insert(newUser)
        .then(() => {
            res.redirect("/viewUsers");
        })
        .catch(dbErr => {
            console.error("Add user error:", dbErr.message);
            res.status(500).render("addUser", { error_message: "Unable to save user. Please try again." });
        });
});

app.post("/addSignUp", (req, res) => {
    const { email, password, level } = req.body;

    if (!email || !password) {
        return res.status(400).render("signup", { error_message: "All fields are required." });
    }

    const newUser = { email, password, level };

    knex("users")
        .insert(newUser)
        .then(() => {
            res.redirect("/login");
        })
        .catch(dbErr => {
            console.error("Add user error:", dbErr.message);
            res.status(500).render("signup", { error_message: "Unable to save user. Please try again." });
        });
});

// Edit user
app.post("/editUser/:user_id", (req, res) => {
    const userId = req.params.user_id;
    const { email, password, level } = req.body;

    if (!email || !password || !level) {
        return knex("users").where({ user_id: userId }).first()
            .then(user => {
                if (!user) {
                    return res.status(404).render("viewUsers", {
                        users: [],
                        error_message: "User not found."
                    });
                }

                res.status(400).render("editUser", {
                    user,
                    error_message: "All fields are required."
                });
            })
            .catch(err => {
                console.error("Error loading user:", err);
                res.status(500).render("viewUsers", {
                    users: [],
                    error_message: "Unable to load user for editing."
                });
            });
    }

    const updatedUser = { email, password, level };

    knex("users")
        .where({ user_id: userId })
        .update(updatedUser)
        .then(rowsUpdated => {
            if (rowsUpdated === 0) {
                return res.status(404).render("viewUsers", {
                    users: [],
                    error_message: "User not found."
                });
            }
            res.redirect("/viewUsers");
        })
        .catch(err => {
            console.error("Error updating user:", err);
            knex("users").where({ user_id: userId }).first()
                .then(user => {
                    res.status(500).render("editUser", {
                        user,
                        error_message: "Unable to update user. Please try again."
                    });
                })
                .catch(fetchErr => {
                    console.error("Post-update fetching error:", fetchErr);
                    res.status(500).render("viewUsers", {
                        users: [],
                        error_message: "Unable to update user."
                    });
                });
        });
});

// Delete user
app.post("/deleteUser/:user_id", (req, res) => {
    knex("users")
        .where("user_id", req.params.user_id)
        .del()
        .then(() => {
            res.redirect("/viewUsers");
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ err });
        });
});


/* --------------------------------
---------- DELETE ROUTES ----------
----------------------------------*/

app.post("/deletePart/:part_id", (req, res) => {
    knex("participant_info").where("part_id", req.params.part_id).del().then(parts => {
        res.redirect("/viewPart");
    }).catch(err => {
        console.log(err);
        res.status(500).json({err});
    })
});


/* ---------------------------------------------------------
---------- SET UP SERVER TO LISTEN ON DESIRED PORT ---------
----------------------------------------------------------*/
app.listen(port, () => {
    console.log("The server is listening");
});