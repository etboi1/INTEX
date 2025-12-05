# Welcome to the Joyous-and-not-utterly-soul-sucking Experience That Was the Group 1-1 INTEX!!

## Grading Info for TAs
- URL: https://ella-rises-1.1.is404.net/
- Sample manager login info:
    - email: ella.johnson0@learners.net
    - password: ellapassword
- Sample user login info:
    - email: penelope.martinez4@studentmail.org
    - password: penelopepassword

## Notes On Above-and-beyond Areas
- Password hashing: 
    - Used bcrypt to store hashed passwords and check the user-input plain-text passwords against the stored hashed passwords
    - Note that there is no way to un-hash a hashed password, so we chose not to display the passwords for managers
- RWD/Mobile-friendly:
    - At least in most ways, the website has a responsive layout that resizes appropriately for different screen sizes
    - This can be seen with the navbar adapting to fit different sized screens without overflowing
    - Tables will require scrolling sideways to view, but within their respective div
    - NOTE: two views are not mobile-friendly (users and donate tab). We realized they weren't with only a bit of time until the deadline and they weren't a priority to fix. I hope you'll still take into account the adaptive layout of the rest of the website

## Other Notes
- If you open our code in VSCode, it may give you an IDE warning on donationImpact.ejs. This is a VSCode issue; the code runs fine
