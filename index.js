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

// for stylesheet connection
app.use("/styles", express.static(__dirname + "/styles"));

// Tells Express how to read form data sent in the body of a request
app.use(express.urlencoded({extended: true}));

// Global authentication middleware - runs on EVERY request
// ----- WE WILL MODIFY THIS TO PROTECT THE APPROPRIATE ROUTES -----
app.use((req, res, next) => {
    // Skip authentication for login routes
    if (req.path === '/' || req.path === '/login' || req.path === '/logout' || req.path === '/signup' || req.path === '/addSignUp' || req.path === '/donationImpact') {
        //continue with the request path
        return next();
    }
    
    // Check if user is logged in for all other routes
    if (req.session.isLoggedIn && (req.path === '/viewPart' || req.path === '/viewAllDonations' || req.path === '/viewAllMilestones' || req.path === '/viewEvents' || req.path === '/displayMilestones' || req.path === '/searchAllDonations' || req.path === '/searchAllMilestones' || req.path === '/searchPart' || req.path === '/searchEvent')) {
        return next(); // User is logged in, continue
    } 
    else if (!req.session.isLoggedIn && req.path === '/viewPart'){
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


app.get("/", (req, res) => {
    res.render("index", {level: req.session.level, login: req.session.isLoggedIn})
})

app.get("/login", (req, res) => {
    res.render("login", { error_message: "" })
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
                    level: req.session.level,
                    parts: [],
                    error_message: "Part not found."
                });
            }
            res.render("editPart", {part: part, error_message: ""})
        })
        .catch((err) => {
            console.error("Error fetching part:", err.message);
            res.status(500).render("viewPart", {
                level: req.session.level,
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

    // Required fields check
    if (!part_email || !part_first_name || !part_last_name || !part_dob ||
        !part_role || !part_phone || !part_city || !part_state || !part_zip ||
        !part_school_or_employer || !total_donations) {

        return res.status(400).render("addPart", { error_message: "All fields are required." });
    }

    return knex("participant_info")
        .where("part_email", part_email)
        .first()
        .then(part => {
            if (part) {
                return res.render("addPart", { error_message: "Email is already in use" });
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

app.post("/editPart/:part_id", (req, res) => {
    const partId = req.params.part_id;
    const {part_email, part_first_name, part_last_name, part_dob, part_role, part_phone, part_city, part_state, part_zip, part_school_or_employer, total_donations} = req.body;

    // Required fields check
    if (
        !part_email || !part_first_name || !part_last_name || !part_dob ||
        !part_role || !part_phone || !part_city || !part_state ||
        !part_zip || !part_school_or_employer || !total_donations
    ) {
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

    // 1. Load original participant to compare email
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

            // 2. If email has NOT changed → update immediately
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
                    part_school_or_employer,
                    total_donations
                };

                return knex("participant_info")
                    .where({ part_id: partId })
                    .update(updatedPart)
                    .then(() => res.redirect("/viewPart"));
            }

            // 3. Email WAS changed → check for duplicate email
            return knex("participant_info")
                .where({ part_email })
                .first()
                .then(existing => {
                    if (existing) {
                        // Email is already used by another participant
                        return res.render("editPart", {
                            part: originalPart,
                            error_message: "Email is already in use"
                        });
                    }

                    // 4. Email is free → update safely
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

                    return knex("participant_info")
                        .where({ part_id: partId })
                        .update(updatedPart)
                        .then(() => res.redirect("/viewPart"));
                });
        })
        .catch(err => {
            console.error("Error updating participant:", err.message);

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

                    return res.status(500).render("editPart", {
                        part,
                        error_message: "Unable to update participant. Please try again."
                    });
                })
                .catch(fetchErr => {
                    console.error("Error fetching participant after update failure:", fetchErr.message);
                    return res.status(500).render("viewPart", {
                        level: req.session.level,
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

    knex.select().from("users").where("email", email).first().then(user => {
        if (user) {
            return res.render("addUser", { error_message: "Email is already in use" });
        }

    const newUser = { email, password, level };

    return knex("users")
        .insert(newUser)
        .then(() => {
            return res.redirect("/viewUsers");
        })
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

    knex.select().from("users").where("email", email).first().then(user => {
        if (user) {
            return res.render("signup", { error_message: "Email is already in use" });
        }

        const newUser = { email, password, level };

        return knex("users")
            .insert(newUser)
            .then(() => {
                return res.redirect("/login");
            })
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

    // 1. Load the original user so we can check if they changed the email
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

            // 2. If email has NOT changed, skip duplicate check
            if (originalUser.email === email) {
                const updatedUser = { email, password, level };
                return knex("users")
                    .where({ user_id: userId })
                    .update(updatedUser)
                    .then(() => res.redirect("/viewUsers"));
            }

            // 3. If email HAS changed, check for duplicates
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

                    // 4. Email is safe to use, update normally
                    const updatedUser = { email, password, level };

                    return knex("users")
                        .where({ user_id: userId })
                        .update(updatedUser)
                        .then(() => res.redirect("/viewUsers"));
                });
        })
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

app.post("/deletePart/:part_id", (req, res) => {
    knex("participant_info").where("part_id", req.params.part_id).del().then(parts => {
        res.redirect("/viewPart");
    }).catch(err => {
        console.log(err);
        res.status(500).json({err});
    })
});









app.get("/milestones/:partId", (req, res) => {
    const partId = req.params.partId;

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
                .catch((err) => {
                    console.error("Error loading milestones:", err.message);
                    res.status(500).render("viewPart", {
                        level: req.session.level,
                        parts: [],
                        error_message: "Unable to load milestones."
                    });
                });
        })
        .catch((err) => {
            console.error("Error loading participant:", err.message);
            res.status(500).render("viewPart", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participant."
            });
        });
});


app.get("/milestones/:partId/add", (req, res) => {
    const partId = req.params.partId;

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

            res.render("addMilestone", {
                level: req.session.level,
                participant,
                error_message: ""
            });
        })
        .catch((err) => {
            console.error("Error loading participant:", err.message);
            res.status(500).render("viewPart", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participant."
            });
        });
});

app.post("/milestones/:partId/add", (req, res) => {
    const partId = req.params.partId;
    const { milestone_title, milestone_date } = req.body;

    if (!milestone_title || !milestone_date) {
        return res.status(400).render("addMilestone", {
            level: req.session.level,
            error_message: "Title and date are required.",
            participant: { part_id: partId }
        });
    }

    // Determine next milestone number
    knex("participant_milestones")
        .where({ part_id: partId })
        .max("milestone_number as maxNum")
        .first()
        .then((result) => {
            const nextNumber = (result.maxNum || 0) + 1;

            return knex("participant_milestones").insert({
                part_id: partId,
                milestone_number: nextNumber,
                milestone_title,
                milestone_date
            });
        })
        .then(() => {
            res.redirect(`/milestones/${partId}`);
        })
        .catch((err) => {
            console.error("Error adding milestone:", err.message);
            res.status(500).render("addMilestone", {
                level: req.session.level,
                participant: { part_id: partId },
                error_message: "Unable to add milestone."
            });
        });
});

app.get("/milestones/:partId/edit/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;

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

            res.render("editMilestone", {
                level: req.session.level,
                milestone,
                participantId: partId,
                error_message: ""
            });
        })
        .catch((err) => {
            console.error("Error loading milestone:", err.message);
            res.status(500).render("displayMilestones", {
                level: req.session.level,
                participant: { part_id: partId },
                milestones: [],
                error_message: "Unable to load milestone."
            });
        });
});

app.post("/milestones/:partId/edit/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;
    const { milestone_title, milestone_date } = req.body;

    knex("participant_milestones")
        .where({
            part_id: partId,
            milestone_number: milestoneNumber
        })
        .update({
            milestone_title,
            milestone_date
        })
        .then(() => {
            res.redirect(`/milestones/${partId}`);
        })
        .catch((err) => {
            console.error("Error updating milestone:", err.message);
            res.status(500).render("editMilestone", {
                level: req.session.level,
                milestone: { part_id: partId, milestone_number: milestoneNumber },
                error_message: "Unable to update milestone."
            });
        });
});

app.post("/milestones/:partId/delete/:milestoneNumber", (req, res) => {
    const { partId, milestoneNumber } = req.params;

    knex("participant_milestones")
        .where({
            part_id: partId,
            milestone_number: milestoneNumber
        })
        .del()
        .then(() => {
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
    knex("event_occurrences as eo")
        .join("event_templates as et", "eo.event_id", "et.event_id")
        .join("location_capacities as lc", "eo.location_id", "lc.location_id")
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
        .then(events => {
            res.render("viewEvents", {
                level: req.session.level,
                events,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading events:", err.message);
            res.render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to load events."
            });
        });
});

app.get("/searchEvent", (req, res) => {
    if (req.query.eventName === "") {
        return res.redirect("/viewEvents");
    }

    knex("event_occurrences as eo")
        .join("event_templates as et", "eo.event_id", "et.event_id")
        .join("location_capacities as lc", "eo.location_id", "lc.location_id")
        .where("et.event_name", req.query.eventName)
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
        .then(events => {
            res.render("viewEvents", {
                level: req.session.level,
                events,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error searching events:", err.message);
            res.render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to search events."
            });
        });
});

app.get("/addEvent", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    Promise.all([
        knex("event_templates").select(),
        knex("location_capacities").select()
    ])
        .then(([templates, locations]) => {
            res.render("addEvent", {
                level: req.session.level,
                templates,
                locations,
                error_message: ""
            });
        })
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

app.post("/addEvent", (req, res) => {
    const { event_id, event_start_date_time, event_end_date_time, location_id, event_registration_deadline } = req.body;

    if (!event_id || !event_start_date_time || !event_end_date_time || !location_id || !event_registration_deadline) {
        return Promise.all([
            knex("event_templates").select(),
            knex("location_capacities").select()
        ]).then(([templates, locations]) => {
            res.status(400).render("addEvent", {
                level: req.session.level,
                templates,
                locations,
                error_message: "All fields are required."
            });
        });
    }

    const newEvent = {
        event_id,
        event_start_date_time,
        event_end_date_time,
        location_id,
        event_registration_deadline
    };

    knex("event_occurrences")
        .insert(newEvent)
        .then(() => {
            res.redirect("/viewEvents");
        })
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

app.get("/editEvent/:event_occurrence_id", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    const eventOccurrenceId = req.params.event_occurrence_id;

    Promise.all([
        knex("event_occurrences").where({ event_occurrence_id: eventOccurrenceId }).first(),
        knex("event_templates").select(),
        knex("location_capacities").select()
    ])
        .then(([event, templates, locations]) => {
            if (!event) {
                return res.status(404).render("viewEvents", {
                    level: req.session.level,
                    events: [],
                    error_message: "Event not found."
                });
            }

            res.render("editEvent", {
                level: req.session.level,
                event,
                templates,
                locations,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading editEvent page:", err.message);
            res.status(500).render("viewEvents", {
                level: req.session.level,
                events: [],
                error_message: "Unable to load event."
            });
        });
});
app.post("/editEvent/:event_occurrence_id", (req, res) => {
    const eventOccurrenceId = req.params.event_occurrence_id;
    const { event_id, event_start_date_time, event_end_date_time, location_id, event_registration_deadline } = req.body;

    const updatedEvent = {
        event_id,
        event_start_date_time,
        event_end_date_time,
        location_id,
        event_registration_deadline
    };

    knex("event_occurrences")
        .where({ event_occurrence_id: eventOccurrenceId })
        .update(updatedEvent)
        .then(() => {
            res.redirect("/viewEvents");
        })
        .catch(err => {
            console.error("Error updating event:", err.message);
            res.status(500).render("editEvent", {
                event: { event_occurrence_id: eventOccurrenceId },
                error_message: "Unable to update event."
            });
        });
});

app.post("/deleteEvent/:event_occurrence_id", (req, res) => {
    knex("event_occurrences")
        .where({ event_occurrence_id: req.params.event_occurrence_id })
        .del()
        .then(() => {
            res.redirect("/viewEvents");
        })
        .catch(err => {
            console.error("Error deleting event:", err.message);
            res.status(500).json({ err });
        });
});
















app.get("/viewAllMilestones", (req, res) => {
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
        .orderBy(["pm.part_id", "pm.milestone_number"])
        .then(milestones => {
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading milestones:", err.message);
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones: [],
                error_message: "Unable to load milestones."
            });
        });
});


app.get("/addMilestoneGlobal", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    knex("participant_info")
        .select("part_id", "part_email", "part_first_name", "part_last_name")
        .orderBy("part_last_name")
        .then(parts => {
            res.render("addMilestoneGlobal", {
                level: req.session.level,
                parts,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading participants:", err.message);
            res.render("addMilestoneGlobal", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participants."
            });
        });
});

app.post("/addMilestoneGlobal", (req, res) => {
    const { part_id, milestone_title, milestone_date } = req.body;

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
            const nextNum = (result.maxNum || 0) + 1;

            return knex("participant_milestones")
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
        .catch(err => {
            console.error("Error adding milestone:", err.message);
            res.status(500).redirect("/viewAllMilestones");
        });
});

app.get("/editMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;

    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        .first()
        .then(milestone => {
            if (!milestone) {
                return res.redirect("/viewAllMilestones");
            }

            res.render("editMilestoneGlobal", {
                level: req.session.level,
                milestone,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

app.post("/editMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;
    const { milestone_title, milestone_date } = req.body;

    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        .update({
            milestone_title,
            milestone_date
        })
        .then(() => res.redirect("/viewAllMilestones"))
        .catch(err => {
            console.error("Error updating milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

app.post("/deleteMilestoneGlobal/:part_id/:milestone_number", (req, res) => {
    const partId = req.params.part_id;
    const milestoneNumber = req.params.milestone_number;

    knex("participant_milestones")
        .where({ part_id: partId, milestone_number: milestoneNumber })
        .del()
        .then(() => res.redirect("/viewAllMilestones"))
        .catch(err => {
            console.error("Error deleting milestone:", err.message);
            res.redirect("/viewAllMilestones");
        });
});

app.get("/searchAllMilestones", (req, res) => {
    const search = req.query.search;

    if (!search || search.trim() === "") {
        return res.redirect("/viewAllMilestones");
    }

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
        .where("pi.part_email", "ilike", `%${search}%`)
        .orWhere("pm.milestone_title", "ilike", `%${search}%`)
        .orderBy(["pm.part_id", "pm.milestone_number"])
        .then(milestones => {
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error searching milestones:", err.message);
            res.render("viewAllMilestones", {
                level: req.session.level,
                milestones: [],
                error_message: "Unable to search milestones."
            });
        });
});







app.get("/viewAllDonations", (req, res) => {
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
            "pi.total_donations"
        )
        .orderBy(["pd.part_id", "pd.donation_number"])
        .then(donations => {
            res.render("viewAllDonations", {
                level: req.session.level,
                donations,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading donations:", err.message);
            res.render("viewAllDonations", {
                level: req.session.level,
                donations: [],
                error_message: "Unable to load donations."
            });
        });
});

app.get("/addDonationGlobal", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    knex("participant_info")
        .select("part_id", "part_email", "part_first_name", "part_last_name")
        .orderBy("part_last_name")
        .then(parts => {
            res.render("addDonationGlobal", {
                level: req.session.level,
                parts,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading participants:", err.message);
            res.render("addDonationGlobal", {
                level: req.session.level,
                parts: [],
                error_message: "Unable to load participants."
            });
        });
});

app.post("/addDonationGlobal", (req, res) => {
    const { part_id, donation_date, donation_amount } = req.body;

    if (!part_id || !donation_date || !donation_amount) {
        return knex("participant_info").select().then(parts => {
            res.status(400).render("addDonationGlobal", {
                level: req.session.level,
                parts,
                error_message: "All fields are required."
            });
        });
    }

    knex("participant_donations")
        .where({ part_id })
        .max("donation_number as maxNum")
        .first()
        .then(result => {
            const nextNum = (result.maxNum || 0) + 1;

            return knex("participant_donations").insert({
                part_id,
                donation_number: nextNum,
                donation_date,
                donation_amount
            });
        })
        .then(() => {
            return knex("participant_info")
                .where({ part_id })
                .update({
                    total_donations: knex.raw(`
                        (SELECT COALESCE(SUM(donation_amount), 0)
                            FROM participant_donations
                            WHERE part_id = ?)
                    `, [part_id])
                });
        })
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error adding donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});


app.get("/editDonationGlobal/:part_id/:donation_number", (req, res) => {
    if (req.session.level !== "m") {
        return res.redirect("/");
    }

    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;

    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .first()
        .then(donation => {
            if (!donation) return res.redirect("/viewAllDonations");

            res.render("editDonationGlobal", {
                level: req.session.level,
                donation,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error loading donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});

app.post("/editDonationGlobal/:part_id/:donation_number", (req, res) => {
    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;
    const { donation_date, donation_amount } = req.body;

    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .update({ donation_date, donation_amount })
        .then(() => {
            return knex("participant_info")
                .where({ part_id: partId })
                .update({
                    total_donations: knex.raw(`
                        (SELECT COALESCE(SUM(donation_amount), 0)
                            FROM participant_donations
                            WHERE part_id = ?)
                    `, [partId])
                });
        })
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error updating donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});


app.post("/deleteDonationGlobal/:part_id/:donation_number", (req, res) => {
    const partId = req.params.part_id;
    const donationNumber = req.params.donation_number;

    knex("participant_donations")
        .where({ part_id: partId, donation_number: donationNumber })
        .del()
        .then(() => {
            return knex("participant_info")
                .where({ part_id: partId })
                .update({
                    total_donations: knex.raw(`
                        (SELECT COALESCE(SUM(donation_amount), 0)
                            FROM participant_donations
                            WHERE part_id = ?)
                    `, [partId])
                });
        })
        .then(() => res.redirect("/viewAllDonations"))
        .catch(err => {
            console.error("Error deleting donation:", err.message);
            res.redirect("/viewAllDonations");
        });
});


app.get("/searchAllDonations", (req, res) => {
    const search = req.query.search;

    if (!search || search.trim() === "") {
        return res.redirect("/viewAllDonations");
    }

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
            "pi.total_donations"
        )
        .where("pi.part_email", "ilike", `%${search}%`)
        .orWhereRaw("CAST(pd.donation_date AS TEXT) ILIKE ?", [`%${search}%`])
        .orderBy("pd.part_id")
        .orderBy("pd.donation_number")
        .then(donations => {
            res.render("viewAllDonations", {
                level: req.session.level,
                donations,
                error_message: ""
            });
        })
        .catch(err => {
            console.error("Error searching donations:", err.message);
            res.render("viewAllDonations", {
                level: req.session.level,
                donations: [],
                error_message: "Unable to search donations."
            });
        });
});

app.get("/donationImpact", (req, res) => {
    res.render("donationImpact", { level: req.session.level, login: req.session.isLoggedIn } );
});

/* ---------------------------------------------------------
---------- SET UP SERVER TO LISTEN ON DESIRED PORT ---------
----------------------------------------------------------*/
app.listen(port, () => {
    console.log("The server is listening");
});