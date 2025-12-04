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
        database : process.env.RDS_DB_NAME || "ellarises",
        port : process.env.RDS_PORT || 5432,
        ssl : process.env.DB_SSL ? {rejectUnauthorized: false} : false
    }
});

// for stylesheet connection
app.use("/styles", express.static(__dirname + "/styles"));

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (req.path === '/' || req.path === '/login' || req.path === '/logout' || req.path === '/signup' || req.path === '/addSignUp' || req.path === '/donationImpact' || req.path === '/publicDonate' || req.path === '/privacy') {
        //continue with the request path
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn && (req.path === '/viewPart' || req.path === '/viewAllDonations' || req.path === '/viewAllMilestones' || req.path === '/viewEvents' || req.path === '/displayMilestones' || req.path === '/searchAllDonations' || req.path === '/searchAllMilestones' || req.path === '/searchPart' || req.path === '/searchEvent')) {
        return next(); // User is logged in, continue
    } // If they are not logged in
    else if (!req.session.isLoggedIn && (req.path === '/viewPart' || req.path === '/viewAllDonations' || req.path === '/viewAllMilestones' || req.path === '/viewEvents' || req.path === '/displayMilestones' || req.path === '/searchAllDonations' || req.path === '/searchAllMilestones' || req.path === '/searchPart' || req.path === '/searchEvent')){
        return res.render("login", { error_message: "Please log in to access this page" });
    }

    if (req.session.isLoggedIn && req.session.level === 'm') {
        return next(); // User is logged in and a manager --> continue
    } else if (req.session.isLoggedIn) {
        return res.redirect("/")
    } else {
        return res.redirect("/login")
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

// Render the landing page
app.get("/", (req, res) => {
    res.render("index", {level: req.session.level, login: req.session.isLoggedIn})
})

// Route for login page
app.get("/login", (req, res) => {
    res.render("login", { error_message: "" })
})

// Route for signup page
app.get("/signup", (req, res) => {
    res.render("signup", { error_message: "" })
})

// View to see list of participants
app.get("/viewPart", (req, res) => {
    knex.select().from("participant_info").then(parts => {
        // Make sure we know the level and list of participants
        res.render("viewPart", {level: req.session.level, parts: parts, error_message: ""})
    })
    // for DB errors
    .catch(err => {
        console.error("Participant error:", err);
        res.render("viewPart", {level: req.session.level, parts: [], error_message: "Participant Table cannot be found" });
    });
})

// Route to display a table of participants based off of their search
app.get("/searchPart", (req, res) => {
    // Show all if they search an empty search bar
    if (req.query.emailSearch === "") {
        return res.redirect("/viewPart");
    }

    // Display participants where the email is equal to the search bar
    knex.select().from("participant_info").where("part_email", req.query.emailSearch).then(parts => {
        res.render("viewPart", {level: req.session.level, parts: parts, error_message: ""})
    })
    // DB error handling
    .catch(err => {
        console.error("Participant error:", err);
        res.render("viewPart", {level: req.session.level, parts: [], error_message: "Participant Table cannot be found" });
    });
})

// Route to get to the view to add a participant
app.get("/addPart", (req, res) => {
    // middleware already does this but make sure that they are a manager
    if (req.session.level === "m") {
        res.render("addPart", {error_message: ""})
    // if they are not a manager
    } else {
        res.redirect("/")
    }
})

// Route to get the view to edit a participant
app.get("/editPart/:part_id", (req, res) => {
    // Make sure user us a manager
    if (req.session.level === "m") {
        // edit the participant that was passed into the get route
        knex.select().from("participant_info").where("part_id", req.params.part_id).first().then(part => {
            // Make sure the participant exists
            if (!part) {
                return res.status(404).render("viewPart", {
                    level: req.session.level,
                    parts: [],
                    error_message: "Participant not found."
                });
            }
            res.render("editPart", {part: part, error_message: ""})
        })
        // db error handling
        .catch((err) => {
            console.error("Error fetching part:", err.message);
            res.status(500).render("viewPart", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participant for editing."
            });
        });
    // if they are not a manager
    } else {
        res.redirect("/")
    }
})


                                                                // USERS PAGE

// View all users (master only)
app.get("/viewUsers", (req, res) => {
    // Make sure user is a manager
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    // grab users from users table
    knex.select().from("users").then(users => {
        res.render("viewUsers", { level: req.session.level, users: users, error_message: "" });
    })
    // db errors
    .catch(err => {
        console.error("Users error:", err);
        res.render("viewUsers", { level: req.session.level, users: [], error_message: "Users table cannot be found" });
    });
});

// Returns the users table but only where the user email matches the search
app.get("/searchUser", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }
    // return all users if the search bar is submitted empty
    if (req.query.emailSearch === "") {
        return res.redirect("/viewUsers");
    }
    // return searched user
    knex.select().from("users").where("email", req.query.emailSearch).then(users => {
        res.render("viewUsers", { level: req.session.level, users: users, error_message: "" });
    })
    // db error
    .catch(err => {
        console.error("Users error:", err);
        res.render("viewUsers", { level: req.session.level, users: [], error_message: "Users table cannot be found" });
    });
});

// Add user page
app.get("/addUser", (req, res) => {
    if (req.session.level === "m") {
        // render the page if user is a manager level
        res.render("addUser", { error_message: "" });
    } else {
        res.redirect("/");
    }
});

// Edit user page
app.get("/editUser/:user_id", (req, res) => {
    // make sure manager
    if (req.session.level === "m") {
        knex("users")
            .where("user_id", req.params.user_id)
            .first()
            .then(user => {
                // make sure the user to edit exists
                if (!user) {
                    return res.status(404).render("viewUsers", {
                        users: [],
                        error_message: "User not found."
                    });
                }
                // render the edit page
                res.render("editUser", { user: user, error_message: "" });
            })
            // db errors
            .catch(err => {
                console.error("Edit user error:", err);
                res.status(500).render("viewUsers", {
                    users: [],
                    error_message: "Unable to load user for editing."
                });
            });
    } else {
        // if user isnt manager
        res.redirect("/");
    }
});


/* --------------------------------
----------- POST ROUTES -----------
----------------------------------*/

// Make sure login credentials are valid
app.post("/login", (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    // grab user where login matches
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

// POST to add a participant
app.post("/addPart", (req, res) => {
    // pull all form fields from the request
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
        part_school_or_employer
    } = req.body;

    // make sure nothing important was left blank
    if (!part_email || !part_first_name || !part_last_name || !part_dob ||
        !part_role || !part_phone || !part_city || !part_state || !part_zip ||
        !part_school_or_employer) {

        return res.status(400).render("addPart", { error_message: "All fields are required." });
    }

    // check if this email is already being used by another participant
    return knex("participant_info")
        .where("part_email", part_email)
        .first()
        .then(part => {
            if (part) {
                return res.render("addPart", { error_message: "Email is already in use" });
            }

            // build the object we’ll insert into the table
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
                part_school_or_employer
            };

            // save the new participant and go back to the list
            return knex("participant_info")
                .insert(newPart)
                .then(() => res.redirect("/viewPart"));
        })
        .catch(dbErr => {
            console.error("Add participant error:", dbErr.message);
            res.status(500).render("addPart", { 
                error_message: "Unable to save participant. Please try again." 
            });
        });
}); 


// POST to update an existing participant
app.post("/editPart/:part_id", (req, res) => {
    const partId = req.params.part_id;

    // fields coming back from the edit form
    const {part_email, part_first_name, part_last_name, part_dob, part_role, part_phone, part_city, part_state, part_zip, part_school_or_employer} = req.body;

    // check for missing required fields
    if (
        !part_email || !part_first_name || !part_last_name || !part_dob ||
        !part_role || !part_phone || !part_city || !part_state ||
        !part_zip || !part_school_or_employer
    ) {
        // reload the participant so we can re-fill the form with their info
        return knex("participant_info")
            .where({ part_id: partId })
            .first()
            .then(part => {
                if (!part) {
                    return res.status(404).render("viewPart", {
                        level: req.session.level,
                        parts: [],
                        error_message: "Participant not found."
                    });
                }

                return res.status(400).render("editPart", {
                    part,
                    error_message: "All fields are required."
                });
            })
            .catch(err => {
                console.error("Error fetching participant:", err.message);
                return res.status(500).render("viewPart", {
                    level: req.session.level,
                    parts: [],
                    error_message: "Unable to load participant for editing."
                });
            });
    }

    // grab the original record so we can compare emails
    knex("participant_info")
        .where({ part_id: partId })
        .first()
        .then(originalPart => {
            if (!originalPart) {
                return res.status(404).render("viewPart", {
                    level: req.session.level,
                    parts: [],
                    error_message: "Participant not found."
                });
            }

            // if the email stayed the same, no need to check duplicates
            if (originalPart.part_email === part_email) {
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
                    part_school_or_employer
                };

                // update the record and return to the list
                return knex("participant_info")
                    .where({ part_id: partId })
                    .update(updatedPart)
                    .then(() => res.redirect("/viewPart"));
            }

            // email changed, so we check if someone else is using it
            return knex("participant_info")
                .where({ part_email })
                .first()
                .then(existing => {
                    if (existing) {
                        // someone else already has this email
                        return res.render("editPart", {
                            part: originalPart,
                            error_message: "Email is already in use"
                        });
                    }

                    // new email is available, so update with the new info
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
                        part_school_or_employer
                    };
                    // apply the update now that the email is valid
                    return knex("participant_info")
                        .where({ part_id: partId })
                        .update(updatedPart)
                        .then(() => res.redirect("/viewPart"));
                });
        })
        .catch(err => {
            console.error("Error updating participant:", err.message);

            // reload the participant so we can show an error message
            return knex("participant_info")
                .where({ part_id: partId })
                .first()
                .then(part => {
                    if (!part) {
                        return res.status(404).render("viewPart", {
                            level: req.session.level,
                            parts: [],
                            error_message: "Participant not found."
                        });
                    }

                    // show error on edit page with their info filled in
                    return res.status(500).render("editPart", {
                        part,
                        error_message: "Unable to update participant. Please try again."
                    });
                })
                .catch(fetchErr => {
                    console.error("Error fetching participant after update failure:", fetchErr.message);

                    // fallback if we can't reload anything
                    return res.status(500).render("viewPart", {
                        level: req.session.level,
                        parts: [],
                        error_message: "Unable to update participant."
                    });
                });
        });
});



// ------------------------------------------------------
//                      User Data
// ------------------------------------------------------

// Add user from manager page
app.post("/addUser", (req, res) => {
    const { email, password, level } = req.body;

    // basic required field check
    if (!email || !password || !level) {
        return res.status(400).render("addUser", { error_message: "All fields are required." });
    }

    // make sure email isn't already taken
    knex.select().from("users").where("email", email).first().then(user => {
        if (user) {
            return res.render("addUser", { error_message: "Email is already in use" });
        }

        // build and insert new user
        const newUser = { email, password, level };

        return knex("users")
            .insert(newUser)
            .then(() => res.redirect("/viewUsers"));
    })
    .catch(dbErr => {
        console.error("Add user error:", dbErr.message);
        res.status(500).render("addUser", { error_message: "Unable to save user. Please try again." });
    });
});

// Add user from signup page
app.post("/addSignUp", (req, res) => {
    const { email, password, level } = req.body;

    // signup needs email + password
    if (!email || !password) {
        return res.status(400).render("signup", { error_message: "All fields are required." });
    }

    // check if email is already used
    knex.select().from("users").where("email", email).first().then(user => {
        if (user) {
            return res.render("signup", { error_message: "Email is already in use" });
        }

        // create user and send them to login
        const newUser = { email, password, level };

        return knex("users")
            .insert(newUser)
            .then(() => res.redirect("/login"));
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

    // Validate required fields
    if (!email || !password || !level) {
        return knex("users")
            .where({ user_id: userId })
            .first()
            .then(user => {
                if (!user) {
                    return res.status(404).render("viewUsers", {
                        users: [],
                        error_message: "User not found."
                    });
                }

                return res.status(400).render("editUser", {
                    user,
                    error_message: "All fields are required."
                });
            })
            .catch(err => {
                console.error("Error loading user:", err);
                return res.status(500).render("viewUsers", {
                    users: [],
                    error_message: "Unable to load user for editing."
                });
            });
    }

    // Load the original user to check chanaged email
    knex("users")
        .where({ user_id: userId })
        .first()
        .then(originalUser => {
            if (!originalUser) {
                return res.status(404).render("viewUsers", {
                    users: [],
                    error_message: "User not found."
                });
            }

            // If email has NOT changed, skip duplicate check
            if (originalUser.email === email) {
                const updatedUser = { email, password, level };
                return knex("users")
                    .where({ user_id: userId })
                    .update(updatedUser)
                    .then(() => res.redirect("/viewUsers"));
            }

            // If email HAS changed, check for duplicates
            return knex("users")
                .where({ email })
                .first()
                .then(existingUser => {

                    if (existingUser) {
                        // Email already in use by a different account
                        return res.render("editUser", {
                            user: originalUser,
                            error_message: "Email is already in use"
                        });
                    }

                    // Email is safe to use, update normally
                    const updatedUser = { email, password, level };

                    return knex("users")
                        .where({ user_id: userId })
                        .update(updatedUser)
                        .then(() => res.redirect("/viewUsers"));
                });
        })
        // db errors
        .catch(err => {
            console.error("Error updating user:", err);
            return knex("users")
                .where({ user_id: userId })
                .first()
                .then(user => {
                    return res.status(500).render("editUser", {
                        user,
                        error_message: "Unable to update user. Please try again."
                    });
                })
                // db errors
                .catch(fetchErr => {
                    console.error("Post-update fetching error:", fetchErr);
                    return res.status(500).render("viewUsers", {
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

// delete a participant and return to the list
app.post("/deletePart/:part_id", (req, res) => {
    knex("participant_info")
        .where("part_id", req.params.part_id)
        .del()
        .then(parts => {
            res.redirect("/viewPart");
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({ err });
        });
});

// show milestones for a single participant
app.get("/milestones/:partId", (req, res) => {
    const partId = req.params.partId;

    // load the participant first
    knex("participant_info")
        .where({ part_id: partId })
        .first()
        .then((participant) => {
            if (!participant) {
                return res.status(404).render("viewPart", {
                    level: req.session.level,
                    parts: [],
                    error_message: "Participant not found."
                });
            }

            // load their milestones
            knex("participant_milestones")
                .where({ part_id: partId })
                .orderBy("milestone_number")
                .then((milestones) => {
                    res.render("displayMilestones", {
                        participant,
                        milestones,
                        level: req.session.level,
                        error_message: "",
                        success_message: ""
                    });
                }) 
                // db errors
                .catch((err) => {
                    console.error("Error loading milestones:", err.message);
                    res.status(500).render("viewPart", {
                        level: req.session.level,
                        parts: [],
                        error_message: "Unable to load milestones."
                    });
                });
        })
        // db error
        .catch((err) => {
            console.error("Error loading participant:", err.message);
            res.status(500).render("viewPart", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participant."
            });
        });
});


// show add milestone form
app.get("/milestones/:partId/add", (req, res) => {
    const partId = req.params.partId;

    // load participant
    knex("participant_info")
        .where({ part_id: partId })
        .first()
        .then((participant) => {
            if (!participant) {
                return res.status(404).render("viewPart", {
                    level: req.session.level,
                    parts: [],
                    error_message: "Participant not found."
                });
            }

            // render add milestone page
            res.render("addMilestone", {
                level: req.session.level,
                participant,
                error_message: ""
            });
        })
        .catch((err) => {
            console.error("Error loading participant:", err.message);
            // db error handling
            res.status(500).render("viewPart", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participant."
            });
        });
});

// add milestone
app.post("/milestones/:partId/add", (req, res) => {
    const partId = req.params.partId;
    const { milestone_title, milestone_date } = req.body;

    // basic validation
    if (!milestone_title || !milestone_date) {
        return res.status(400).render("addMilestone", {
            level: req.session.level,
            error_message: "Title and date are required.",
            participant: { part_id: partId }
        });
    }

    // find next milestone number
    knex("participant_milestones")
        .where({ part_id: partId })
        .max("milestone_number as maxNum")
        .first()
        .then((result) => {
            const nextNumber = (result.maxNum || 0) + 1;

            // insert new milestone
            return knex("participant_milestones").insert({
                part_id: partId,
                milestone_number: nextNumber,
                milestone_title,
                milestone_date
            });
        })
        .then(() => {
            // redirect back to milestone list
            res.redirect(`/milestones/${partId}`);
        })
        .catch((err) => {
            console.error("Error adding milestone:", err.message);
            // db error handling
            res.status(500).render("addMilestone", {
                level: req.session.level,
                participant: { part_id: partId },
                error_message: "Unable to add milestone."
            });
        });
});

// show edit milestone form
app.get("/milestones/:partId/edit/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;

    // load milestone
    knex("participant_milestones")
        .where({
            part_id: partId,
            milestone_number: milestoneNumber
        })
        .first()
        .then((milestone) => {
            if (!milestone) {
                return res.status(404).render("displayMilestones", {
                    level: req.session.level,
                    participant: { part_id: partId },
                    milestones: [],
                    error_message: "Milestone not found."
                });
            }

            // render edit page
            res.render("editMilestone", {
                level: req.session.level,
                milestone,
                participantId: partId,
                error_message: ""
            });
        })
        .catch((err) => {
            console.error("Error loading milestone:", err.message);
            // db error handling
            res.status(500).render("displayMilestones", {
                level: req.session.level,
                participant: { part_id: partId },
                milestones: [],
                error_message: "Unable to load milestone."
            });
        });
});

// Edit milestone
app.post("/milestones/:partId/edit/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;
    const { milestone_title, milestone_date } = req.body;

    // greb specific milestone
    knex("participant_milestones")
        .where({
            part_id: partId,
            milestone_number: milestoneNumber
        })
        // update milestone
        .update({
            milestone_title,
            milestone_date
        })
        .then(() => {
            res.redirect(`/milestones/${partId}`);
        })
        // db error handling
        .catch((err) => {
            console.error("Error updating milestone:", err.message);
            res.status(500).render("editMilestone", {
                level: req.session.level,
                milestone: { part_id: partId, milestone_number: milestoneNumber },
                error_message: "Unable to update milestone."
            });
        });
});

// Delete miletsone
app.post("/milestones/:partId/delete/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;

    // grab specific milestone
    knex("participant_milestones")
        .where({
            part_id: partId,
            milestone_number: milestoneNumber
        })
        // delete it
        .del()
        .then(() => {
            // go back to milestones for that user
            res.redirect(`/milestones/${partId}`);
        })
        .catch((err) => {
            console.error("Error deleting milestone:", err.message);
            res.status(500).redirect(`/milestones/${partId}`);
        });
});

/* --------------------------------
------------ EVENTS PAGE ----------
----------------------------------*/

// View all event occurrences
app.get("/viewEvents", (req, res) => {
    // kinda like a more intense sql script here
    knex("event_occurrences as eo")
        // Join tables
        .join("event_templates as et", "eo.event_id", "et.event_id")
        .join("location_capacities as lc", "eo.location_id", "lc.location_id")
        // select what we need
        .select(
            "eo.event_occurrence_id",
            "et.event_name",
            "et.event_type",
            "et.event_description",
            "et.event_recurrence",
            "eo.event_start_date_time",
            "eo.event_end_date_time",
            "eo.event_registration_deadline",
            "lc.location_name",
            "lc.location_capacity"
        )
        .orderBy("eo.event_start_date_time")
        // show page to list all events
        .then(events => {
            res.render("viewEvents", {
                level: req.session.level,
                events,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading events:", err.message);
            res.render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to load events."
            });
        });
});

// Again letting us search events
app.get("/searchEvent", (req, res) => {
    if (req.query.eventName === "") {
        return res.redirect("/viewEvents");
    }

    knex("event_occurrences as eo")
        // joining tables to get all we need
        .join("event_templates as et", "eo.event_id", "et.event_id")
        .join("location_capacities as lc", "eo.location_id", "lc.location_id")
        .where("et.event_name", req.query.eventName)
        // selecting everything we need
        .select(
            "eo.event_occurrence_id",
            "et.event_name",
            "et.event_type",
            "et.event_description",
            "et.event_recurrence",
            "eo.event_start_date_time",
            "eo.event_end_date_time",
            "eo.event_registration_deadline",
            "lc.location_name",
            "lc.location_capacity"
        )
        // show events table with whatever we searched
        .then(events => {
            res.render("viewEvents", {
                level: req.session.level,
                events,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error searching events:", err.message);
            res.render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to search events."
            });
        });
});

// GET route to add an evemt
app.get("/addEvent", (req, res) => {
    // Make sure user is a manaegr
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    // perform all async operations before continuing
    Promise.all([
        knex("event_templates").select(),
        knex("location_capacities").select()
    ])
        .then(([templates, locations]) => {
            // get out add events page with the templates and locations ready to be selected from
            res.render("addEvent", {
                level: req.session.level,
                templates,
                locations,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading addEvent page:", err.message);
            res.render("addEvent", {
                level: req.session.level,
                templates: [],
                locations: [],
                error_message: "Unable to load event creation form."
            });
        });
});

// POST when event is being added to add it to the db
app.post("/addEvent", (req, res) => {
    const { event_id, event_start_date_time, event_end_date_time, location_id, event_registration_deadline } = req.body;

    // make sure everything is filled out
    if (!event_id || !event_start_date_time || !event_end_date_time || !location_id || !event_registration_deadline) {
        // perform all async operations before continuing
        return Promise.all([
            knex("event_templates").select(),
            knex("location_capacities").select()
        ]).then(([templates, locations]) => {
            // get out add events page with the templates and locations ready to be selected from
            res.status(400).render("addEvent", {
                level: req.session.level,
                templates,
                locations,
                error_message: "All fields are required."
            });
        });
    }

    // create newEvent object
    const newEvent = {
        event_id,
        event_start_date_time,
        event_end_date_time,
        location_id,
        event_registration_deadline
    };

    knex("event_occurrences")
    // insert the newEvent
        .insert(newEvent)
        .then(() => {
            res.redirect("/viewEvents");
        })
        // db error handling
        .catch(err => {
            console.error("Error adding event:", err.message);
            res.status(500).render("addEvent", {
                level: req.session.level,
                templates: [],
                locations: [],
                error_message: "Unable to save event."
            });
        });
});

// get route to let users edit an event
app.get("/editEvent/:event_occurrence_id", (req, res) => {
    // make sure they are a manager
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    // grabbing the correct event occurence
    const eventOccurrenceId = req.params.event_occurrence_id;

    // perform all async operations before continuing
    Promise.all([
        knex("event_occurrences").where({ event_occurrence_id: eventOccurrenceId }).first(),
        knex("event_templates").select(),
        knex("location_capacities").select()
    ])
        .then(([event, templates, locations]) => {
            // if the event doesnt exist
            if (!event) {
                return res.status(404).render("viewEvents", {
                    level: req.session.level,
                    events: [],
                    error_message: "Event not found."
                });
            }

            // render edit page with the correct info for the event
            res.render("editEvent", {
                level: req.session.level,
                event,
                templates,
                locations,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading editEvent page:", err.message);
            res.status(500).render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to load event."
            });
        });
});

// POST route to send the edited event to the DB
app.post("/editEvent/:event_occurrence_id", (req, res) => {
    // grabbing the id
    const eventOccurrenceId = req.params.event_occurrence_id;
    // Getting all of the data from the form
    const { event_id, event_start_date_time, event_end_date_time, location_id, event_registration_deadline } = req.body;

    // Changed event object to udpate
    const updatedEvent = {
        event_id,
        event_start_date_time,
        event_end_date_time,
        location_id,
        event_registration_deadline
    };

    // Grab the original event and update it
    knex("event_occurrences")
        .where({ event_occurrence_id: eventOccurrenceId })
        .update(updatedEvent)
        .then(() => {
            res.redirect("/viewEvents");
        })
        // db error handling
        .catch(err => {
            console.error("Error updating event:", err.message);
            res.status(500).render("editEvent", {
                event: { event_occurrence_id: eventOccurrenceId },
                error_message: "Unable to update event."
            });
        });
});

// POST route to delete the event
app.post("/deleteEvent/:event_occurrence_id", (req, res) => {
    // Grab event
    knex("event_occurrences")
        .where({ event_occurrence_id: req.params.event_occurrence_id })
        // and delete it
        .del()
        .then(() => {
            res.redirect("/viewEvents");
        })
        // db error handlign
        .catch(err => {
            console.error("Error deleting event:", err.message);
            res.status(500).json({ err });
        });
});

// GET route to view all of the milestones
app.get("/viewAllMilestones", (req, res) => {
    knex("participant_milestones as pm")
    // joining tables to get participant name and email
        .join("participant_info as pi", "pm.part_id", "pi.part_id")
        .select(
            "pm.part_id",
            "pm.milestone_number",
            "pm.milestone_title",
            "pm.milestone_date",
            "pi.part_email",
            "pi.part_first_name",
            "pi.part_last_name"
        )
        // order the list
        .orderBy(["pm.part_id", "pm.milestone_number"])
        .then(milestones => {
            // render the view page
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading milestones:", err.message);
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones: [],
                error_message: "Unable to load milestones."
            });
        });
});

// get route to add a milestone to the overall list
app.get("/addMilestoneGlobal", (req, res) => {
    // make sure user is a manager
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    // get participant info
    knex("participant_info")
        .select("part_id", "part_email", "part_first_name", "part_last_name")
        .orderBy("part_last_name")
        .then(parts => {
            // load up the page to link to a selected participant
            res.render("addMilestoneGlobal", {
                level: req.session.level,
                parts,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading participants:", err.message);
            res.render("addMilestoneGlobal", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participants."
            });
        });
});

// send the added participant to the database
app.post("/addMilestoneGlobal", (req, res) => {
    // form inputs
    const { part_id, milestone_title, milestone_date } = req.body;

    // Making all iputs are filled in
    if (!part_id || !milestone_title || !milestone_date) {
        return knex("participant_info")
            .select()
            .then(parts => {
                res.status(400).render("addMilestoneGlobal", {
                    level: req.session.level,
                    parts,
                    error_message: "All fields are required."
                });
            });
    }

    // find next milestone number
    knex("participant_milestones")
        .where({ part_id })
        .max("milestone_number as maxNum")
        .first()
        .then(result => {
            // to increase number for the next milestone for that participant
            const nextNum = (result.maxNum || 0) + 1;

            return knex("participant_milestones")
            // insert all of the new info
                .insert({
                    part_id,
                    milestone_number: nextNum,
                    milestone_title,
                    milestone_date
                })
                .then(() => {
                    res.redirect("/viewAllMilestones");
                });
        })
        // db error handling
        .catch(err => {
            console.error("Error adding milestone:", err.message);
            res.status(500).redirect("/viewAllMilestones");
        });
});

// get route to edit a milestone on the global page for milestones
app.get("/editMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;

    // grab the desired milestone
    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        .first()
        .then(milestone => {
            // make sure it exists
            if (!milestone) {
                return res.redirect("/viewAllMilestones");
            }

            // render the edit page with the milestone passed in
            res.render("editMilestoneGlobal", {
                level: req.session.level,
                milestone,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

//POST route to change the milestone
app.post("/editMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;
    const { milestone_title, milestone_date } = req.body;

    // grab the og milestone
    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        // and update it 
        .update({
            milestone_title,
            milestone_date
        })
        // take us back to all of the milestones
        .then(() => res.redirect("/viewAllMilestones"))
        .catch(err => {
            console.error("Error updating milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

// post route to delete a milestone
app.post("/deleteMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;

    // grab the desired milestone
    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        // & delete it
        .del()
        .then(() => res.redirect("/viewAllMilestones"))
        .catch(err => {
            // db error handling
            console.error("Error deleting milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

// Search capabilites for milestones
app.get("/searchAllMilestones", (req, res) => {
    const search = req.query.search;

    // if empty, return all milestones
    if (!search || search.trim() === "") {
        return res.redirect("/viewAllMilestones");
    }

    // search db for searched text
    knex("participant_milestones as pm")
        .join("participant_info as pi", "pm.part_id", "pi.part_id")
        .select(
            "pm.part_id",
            "pm.milestone_number",
            "pm.milestone_title",
            "pm.milestone_date",
            "pi.part_email",
            "pi.part_first_name",
            "pi.part_last_name"
        )
        // do a like to make it easier for the user
        // for email
        .where("pi.part_email", "ilike", `%${search}%`)
        // for milestone title
        .orWhere("pm.milestone_title", "ilike", `%${search}%`)
        .orderBy(["pm.part_id", "pm.milestone_number"])
        .then(milestones => {
            // show milestone table with searched milestones/users
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error searching milestones:", err.message);
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones: [],
                error_message: "Unable to search milestones."
            });
        });
});

// get route to view donations
app.get("/viewAllDonations", (req, res) => {
    // get donations and join participant info
    knex("participant_donations as pd")
        .join("participant_info as pi", "pd.part_id", "pi.part_id")
        .select(
            "pd.part_id",
            "pd.donation_number",
            "pd.donation_date",
            "pd.donation_amount",
            "pi.part_email",
            "pi.part_first_name",
            "pi.part_last_name",
            // calc total donations on the fly
            knex.raw(`(
                SELECT COALESCE(SUM(donation_amount), 0)
                FROM participant_donations
                WHERE part_id = pd.part_id
            ) AS total_donations`)
        )
        // order by participant then donation number
        .orderBy(["pd.part_id", "pd.donation_number"])
        .then(donations => {
            // render page w/ results
            res.render("viewAllDonations", {
                level: req.session.level,
                donations,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading donations:", err.message);
            res.render("viewAllDonations", {
                level: req.session.level,
                donations: [],
                error_message: "Unable to load donations."
            });
        });
});

// GET: show global add donation page
app.get("/addDonationGlobal", (req, res) => {
    // make sure user is manager
    if (req.session.level !== "m") return res.redirect("/");

    // load participants for dropdown
    knex("participant_info")
        .select("part_id", "part_email", "part_first_name", "part_last_name")
        .orderBy("part_last_name")
        .then(parts => {
            // render add page
            res.render("addDonationGlobal", {
                level: req.session.level,
                parts,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading participants:", err.message);
            res.render("addDonationGlobal", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participants."
            });
        });
});

// POST: add a donation
app.post("/addDonationGlobal", (req, res) => {
    // fields from form
    const { part_id, donation_date, donation_amount } = req.body;

    // validation
    if (!part_id || !donation_date || !donation_amount) {
        return knex("participant_info").select().then(parts => {
            res.status(400).render("addDonationGlobal", {
                level: req.session.level,
                parts,
                error_message: "All fields are required."
            });
        });
    }

    // find next donation number
    knex("participant_donations")
        .where({ part_id })
        .max("donation_number as maxNum")
        .first()
        .then(result => {
            const nextNum = (result.maxNum || 0) + 1;

            // insert donation
            return knex("participant_donations").insert({
                part_id,
                donation_number: nextNum,
                donation_date,
                donation_amount
            });
        })
        // go back to all donations
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error adding donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});

// GET: edit donation page
app.get("/editDonationGlobal/:part_id/:donation_number", (req, res) => {
    // only managers
    if (req.session.level !== "m") return res.redirect("/");

    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;

    // get the donation to autofill
    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .first()
        .then(donation => {
            if (!donation) return res.redirect("/viewAllDonations");

            // render edit page
            res.render("editDonationGlobal", {
                level: req.session.level,
                donation,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error loading donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});

// POST: save edited donation
app.post("/editDonationGlobal/:part_id/:donation_number", (req, res) => {
    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;
    const { donation_date, donation_amount } = req.body;

    // update donation
    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .update({ donation_date, donation_amount })
        // go back to all donations
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error updating donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});

// delete donation
app.post("/deleteDonationGlobal/:part_id/:donation_number", (req, res) => {
    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;

    // delete donation
    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .del()
        // go back to all donations
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error deleting donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});

// search donations
app.get("/searchAllDonations", (req, res) => {
    const search = req.query.search;

    // if empty, show all
    if (!search || search.trim() === "") return res.redirect("/viewAllDonations");

    // search donations + totals
    knex("participant_donations as pd")
        .join("participant_info as pi", "pd.part_id", "pi.part_id")
        .select(
            "pd.part_id",
            "pd.donation_number",
            "pd.donation_date",
            "pd.donation_amount",
            "pi.part_email",
            "pi.part_first_name",
            "pi.part_last_name",
            // dynamic total
            knex.raw(`(
                SELECT COALESCE(SUM(donation_amount), 0)
                FROM participant_donations
                WHERE part_id = pd.part_id
            ) AS total_donations`)
        )
        // search filters
        .where("pi.part_email", "ilike", `%${search}%`)
        .orWhereRaw("CAST(pd.donation_date AS TEXT) ILIKE ?", [`%${search}%`])
        // ordering
        .orderBy("pd.part_id")
        .orderBy("pd.donation_number")
        .then(donations => {
            // show results
            res.render("viewAllDonations", {
                level: req.session.level,
                donations,
                error_message: ""
            });
        })
        // db error handling
        .catch(err => {
            console.error("Error searching donations:", err.message);
            res.render("viewAllDonations", {
                level: req.session.level,
                donations: [],
                error_message: "Unable to search donations."
            });
        });
});


// get page to see impact info
app.get("/donationImpact", (req, res) => {
    res.render("donationImpact", { level: req.session.level, login: req.session.isLoggedIn } );
});

// page that brings up edd event template page
app.get("/addEventTemplate", (req, res) => {
    res.render("addEventTemplate", { error_message: "" });
});

// Create a new event template based on the form
app.post("/addEventTemplate", (req, res) => {
    const { event_name, event_type, event_description, event_recurrence, event_default_capacity } = req.body;

    // insert new event into the templates
    return knex("event_templates")
        .insert({
            event_name,
            event_type,
            event_description,
            event_recurrence,
            event_default_capacity
        })
        .then(() => res.redirect("/addEvent"))
        // db error handling
        .catch(err => res.render("addEventTemplate", { error_message: "Error saving template." }));
});

// page that brings up add location page
app.get("/addLocation", (req, res) => {
    res.render("addLocation", { error_message: null });
});

// create new location template
app.post("/addLocation", (req, res) => {
    const { location_name, location_capacity } = req.body;

    return knex("location_capacities")
        .insert({ location_name, location_capacity })
        .then(() => res.redirect("/addEvent"))
        .catch(err => res.render("addLocation", { error_message: "Error saving location." }));
});

// public donation page (no login required)
app.get("/publicDonate", (req, res) => {
    // render public donation form
    res.render("publicDonate", {
        error_message: "",
        success_message: ""
    });
});

// submit public donation form
app.post("/publicDonate", async (req, res) => {
    const {
        part_email,
        part_first_name,
        part_last_name,
        part_dob,
        part_phone,
        part_city,
        part_state,
        part_zip,
        part_school_or_employer,
        donation_amount,
        donation_date
    } = req.body;

    // quick validation
    if (!part_email || !donation_amount || !donation_date) {
        return res.status(400).render("publicDonate", {
            error_message: "Email, donation date, and amount are required.",
            success_message: ""
        });
    }

    try {
        // check if participant already exists
        let participant = await knex("participant_info")
            .where({ part_email })
            .first();

        let partId;

        if (!participant) {
            // create new participant
            const [newId] = await knex("participant_info")
                .insert({
                    part_email,
                    part_first_name,
                    part_last_name,
                    part_dob,
                    part_role: "p", // default role
                    part_phone,
                    part_city,
                    part_state,
                    part_zip,
                    part_school_or_employer
                })
                .returning("part_id");

            partId = newId.part_id;
        } else {
            // use existing participant
            partId = participant.part_id;
        }

        // find next donation number
        const result = await knex("participant_donations")
            .where({ part_id: partId })
            .max("donation_number as maxNum")
            .first();

        const nextNum = (result.maxNum || 0) + 1;

        // insert donation
        await knex("participant_donations").insert({
            part_id: partId,
            donation_number: nextNum,
            donation_date,
            donation_amount
        });

        // success page
        res.render("publicDonate", {
            error_message: "",
            success_message: "Thank you! Your donation has been recorded."
        });

    } catch (err) {
        console.error("Error processing public donation:", err.message);
        res.status(500).render("publicDonate", {
            error_message: "Unable to process your donation right now.",
            success_message: ""
        });
    }
});

app.get("/privacy", (req, res) => {
    res.sendStatus(418);
})


/* ---------------------------------------------------------
---------- SET UP SERVER TO LISTEN ON DESIRED PORT ---------
----------------------------------------------------------*/
app.listen(port, () => {
    console.log("The server is listening");
});