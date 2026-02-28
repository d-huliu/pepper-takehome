# Submission

**Candidate name:** huliu, david 
**Date:** February 27, 2026
**Time spent:** _Approximate hours_: 6-7 including writting up notes

---

## Completed Tasks

Check off what you finished:

- [. ] Task 1 — Create Product
- [ .] Task 2 — Update Variant
- [ .] Task 3 — Fix soft-delete bug
- [ .] Task 4 — Loading & error states
- [ .] Task 5 — Input validation

---

## Approach & Decisions

_Briefly describe the approach you took for each task. Mention any trade-offs you made or alternative approaches you considered._

## written notes

What is this:
a mini admin panel where someone manages the products they sell

A variant is a specific version of a product. For example, the product might be "Olive Oil" but you sell it in different sizes
SKU (a unique inventory code, like a barcode ID)
Every product must have at least one variant …even if it only comes in one size.

Overall why I chose the given approaches:
prioritize consistency with the existing codebase, no new dependencies, and simplicity proportional to the problem size. The alternatives are all legitimate …they'd be the right choices in bigger, more complex apps. But for this project's scale, they'd add complexity without enough payoff.

Task #1: adding new products to the catalog thing


Wrote the validation checks (is the name empty? are there variants? is the price negative?) as plain if-statements directly in the route, then wrapped the database inserts in a transaction.
Alternatively could use imported libraries to do this, but whatever.
Also could have done like react hooks libraries to track what the user typed, which fields have errors, etc. But again, it's a new dependency, and the form only has ~6 fields.

Before the transaction — prepare the SQL statements:
const insertProduct = db.prepare(`INSERT INTO products ...`);
const insertVariant = db.prepare(`INSERT INTO variants ...`);

db.prepare() just pre-compiles the SQL query into something ready to fire. It doesn't actually write anything to the database yet — it's just the loaded gun, not the shot.

const result = db.transaction(() => {
  // everything inside here is one atomic unit
})();

transaction is basically a way to say to the database: "treat all of these writes as one single all-or-nothing operation." If any one of them fails, the database automatically undoes all the ones that already succeeded ….like it never happened. If they all succeed, then everything gets saved together.

Tldr: make sure you cant have partial variances saved, all elem of prod come in one object package, fails together.

when you create a product, you're actually doing multiple database writes … one for the product itself, then one for each variant. If the product saves fine but a variant fails (say, duplicate SKU), without a transaction you'd have a product sitting in the database with no variants attached. A transaction says "either ALL of these writes succeed, or NONE of them do." It's like an undo button for database operations.



Task 2: on the actual product page, each variant is shown in a table row with an "Edit" button. Before, clicking Edit just popped up an alert saying "not implemented."

Explain:
Partial updates on the backend (only change the fields you send), inline editing on the frontend (cells turn into text boxes in the table row).

The backend alternative was full updates — meaning every time you want to change one thing, you have to send everything. So even if you just want to change the price, you'd also have to send the inventory count, the SKU, the name, etc. It's simpler on the server side (you just overwrite all fields), but it's annoying for the frontend because it has to know and send every current value. Partial updates are what the existing product update route already does, so it was the consistent choice.

The frontend alternative was a modal/popup dialog – click Edit, a box pops up in the middle of the screen with the two fields, you fill them in, click Save. It works fine and gives you more room, but for literally two numbers (price and inventory), opening a whole popup feels excessive. Inline editing is faster ….you click Edit, the numbers turn into editable boxes right there, you change them, hit Save. Done. No popup opening/closing, no context switch. If there were 5+ fields to edit, I'd go with a modal because cramming that many inputs into a table row would look uglier.





Task 3: When you "delete" a product in this app, it doesn't actually get erased from the database. Instead, it gets a deleted_at timestamp ,that's called a soft delete (the data is still there, just marked as deleted). The bug was that the product list page was still showing these "deleted" products because the database query forgot to filter them out. The fix was literally adding one line: "only show me products where deleted_at is empty."

Added one line to the database query ,basically "only give me products where deleted_at is empty."

Alt strat:
SQL view. Think of a view as a saved query. you'd create one called active_products that always automatically excludes deleted ones, and then all your other queries would reference that view instead of the raw table. The benefit is that nobody can ever forget the filter, because it's baked in. But there's only one query in the entire app that needed this fix. Setting up a view means changing the database schema, updating the seed script, and making sure everything references the view. That's a lot of ceremony for what is genuinely a one-line fix. If this app had 10 different places querying products, a view would be the right call.


Task 4: The products page had no feedback while data was loading …you'd just see "0 results found" for a split second, which looks broken. And if the server was down, the page would silently show nothing with no explanation. Now it shows a spinning animation while loading, and a red error message if something goes wrong.

Added two state variables — loading (true/false) and error (empty string or error message). Show a spinner when loading, show a red banner when there's an error.

Alt1:
a custom hook …basically a reusable piece of code like useFetch(url) that returns { data, loading, error } so you don't have to write the loading/error logic every time. Great idea if multiple pages need it, but only one page (the products list) was missing these states. The product detail page already had its own loading handling. Writing a whole reusable hook for one page is premature ….you'd spend more time writing the hook than you'd save.

Alt 2
a library like react-query. It handles loading, errors, caching (so if you go back to a page, it shows the old data instantly while refreshing in the background), retries, and more. It's genuinely fantastic for apps with lots of data fetching. But installing a whole library for one page's loading spinner felt like massive overkill.



Task 5: users can't submit garbage data. On the server: if you try to create a product without a name, or with a negative price, or with a duplicate SKU, it rejects the request with a clear error message. On the form: required fields are marked with a red asterisk, number fields won't accept negatives, and there's a manual check before submitting that catches anything else.

On the server, plain if-statements. On the client, HTML5 attributes (required, min="0") plus manual checks on submit.

server alternative was zod again (same trade-off as Task 1 …great for big projects, overkill here).

On the client, the alternative was validate-on-blur ..meaning checking each field the moment the user clicks/tabs away from it, instead of waiting until they hit Submit. The benefit is faster feedback ("hey, this field is required" shows up immediately). The downside is it can be annoying …if you click into a field accidentally and then click out, it yells at you for leaving it empty even though you weren't trying to fill it out yet. Validate-on-submit is simpler and still catches everything before the data gets sent. For a form this size, the difference in user experience is negligible.



Bonus A: Delete button on the product detail page didn't disable while the delete request was being sent. So if you clicked it 5 times fast, it would send 5 delete requests. Now it grays out and says "Deleting…" after the first click so you can't spam it.


Track a deleting boolean. When you click Delete, it flips to true, which grays out the button. When the request finishes, you get redirected.

Alt:
debouncing/throttling — basically saying "even if you click 5 times, only fire the function once per second." The problem is the button still looks clickable. The user has no idea anything happened or is happening. With the disabled approach, the button visually changes (grayed out, says "Deleting…"), which serves double duty: prevents the double-submit AND gives the user feedback that their action is being processed.



Bonus B: Some backend routes were sending errors as plain text (like just the string "Product not found"), while others sent JSON (like { "error": "Product not found" }). The frontend expects JSON, so the plain text ones could cause parsing issues. I changed the ~4 plain-text ones to all use JSON format.

Found the ~4 places that used .send() (plain text) for errors and changed them to .json({ error: message }).

Alt 1:
 was error-handling middleware — a single function at the app level that catches all errors and formats them as JSON. It's the "right" architecture for bigger apps because any new route automatically gets consistent error formatting. But the existing routes all handle their own errors inline (they catch errors and send responses themselves). To use middleware, you'd have to change every route to not handle errors itself and instead pass them along with next(error). That's a significant refactor touching every route file, just to fix 4 lines of code.

Alt 2
 a helper function like sendError(res, 400, "Name is required") that always formats consistently. Nice in theory, but it relies on every developer remembering to use it. Someone could still write res.send("oops") and reintroduce the inconsistency. For 4 occurrences in a small project, just directly fixing them is the most straightforward path.





## Task 1 — Create Product (end-to-end)

The backend POST route is a stub returning 501, and the create page is just a placeholder. Need to build both the API endpoint and the form.

**Backend — how to build the route:**

- **A) Write validation + DB inserts directly in the route handler, wrap inserts in a transaction**
  - this is how every other route in the project works, keeps things consistent and simple
  - validation code lives right next to the route, which can get long, but it's easy to read top-to-bottom

- **B) Use a validation library like zod to define the expected shape of the data**
  - cleaner to define "name is required, price must be >= 0" as a schema instead of a bunch of if-statements
  - but it adds a new package the project doesn't use anywhere, and for just 2 routes it's a lot of overhead

**Frontend — the form:**

- **A) A regular React form with useState for each field, with add/remove buttons for variants**
  - what you'd expect — text inputs, a dropdown for category, a section where you can add variant rows
  - it's more typing than a library would be, but there's nothing tricky here and it doesn't need any new packages

- **B) Use a form library like react-hook-form**
  - less boilerplate, built-in validation
  - but nobody else in this project uses it, so it would feel out of place and another package to install

**My pick:** Backend A + Frontend A. No extra packages, just keep it consistent with how the rest of the project already works.

On the backend, the key thing is using a **transaction** — basically a way to group multiple database writes into one atomic operation, so if any of them fail, they ALL get undone. Without that, you could end up with a product saved in the database but no variants attached to it if something goes wrong halfway. That would leave bad data sitting around.

I also thought about skipping validation code entirely and just relying on the database itself to reject bad data (it already has rules like "price can't be negative" built into the table). It would technically work, but when the database rejects something, the error message it spits back is super unhelpful — just raw technical gibberish instead of something like "Price must be at least 0." The tests also expect specific error formats, so this wouldn't fly.

On the frontend, the form is small enough (name, description, category, status, plus a couple variant fields) that tracking each field with basic React state is totally fine. If this were a form with 15+ fields, I'd probably use a more structured approach to manage all the state in one place, but for this size it'd just be adding complexity for no reason.

---

## Task 2 — Update Variant (end-to-end)

The PUT route is another 501 stub, and the Edit button just pops an alert. Need the backend route and a way for users to edit price/inventory in the UI.

**Backend:**

- **A) Partial update — only update the fields that were sent in the request body**
  - if you just want to change the price, you only send `{ price_cents: 1500 }` and everything else stays the same
  - this is the same approach the existing product PUT route uses (with COALESCE), so it's consistent

- **B) Full update — require the client to send every field every time**
  - simpler SQL since you just overwrite everything
  - but annoying for the caller — even if they only changed the price they have to re-send inventory, sku, name, etc.

**Frontend — how to let the user edit:**

- **A) Inline editing — clicking Edit turns the table cells into text inputs right there in the row**
  - fast and natural, you click Edit, change the number, click Save, done. no page change or popup
  - can look a bit cramped on small screens

- **B) Pop up a small modal/dialog with the edit form**
  - more room for inputs and error messages
  - but it's just 2 fields (price and inventory) — a modal for that feels like a lot of ceremony

**My pick:** Backend A + Frontend A.

On the backend, partial updates mean the frontend only needs to send the fields that changed — so if you just tweaked the price, you don't have to also re-send the inventory count, name, etc. The existing product update route already works this way, so I'm just following the same pattern to keep things consistent.

For the frontend, inline editing means when you click "Edit" on a row in the table, those cells (price, inventory) turn into little text boxes right there. You type the new value, hit Save, and you're done — no popup, no page change. It's the fastest experience for changing just a number or two.

A popup dialog would also work fine, and honestly if there were more fields to edit (like 5+), I'd go that route because you'd have more room. But for literally two numbers? a whole popup feels like too much ceremony.

I also thought about whether the endpoint should use a different HTTP method (PATCH instead of PUT, since PATCH is technically the "correct" one for partial updates). But the existing code and tests already use PUT, so changing it would just break things for no real benefit.

---

## Task 3 — Fix soft-delete bug

The product list endpoint returns ALL products, including ones that were soft-deleted (where `deleted_at` has a timestamp). They shouldn't show up.

- **A) Add a filter to the query so it only returns products where `deleted_at` is null**
  - one line of code. the categories route already does this exact thing, so this is clearly just a missed filter

- **B) Create a reusable helper or SQL view so this filter is always applied automatically**
  - future-proof but there's only one query that needs this right now, so it's over-engineering it

**My pick:** A. The database query that fetches the product list just forgot to exclude deleted ones. The fix is adding one line that says "only give me products that haven't been deleted." The other part of the app that lists categories already does this correctly, so this was clearly just an oversight.

You could also set up the database itself to always hide deleted products automatically (using something called a "view" — basically a saved query that other queries can reference). That way nobody could ever forget the filter. It's a solid idea for bigger codebases, but for one query in one file? it's a lot of setup for something that's literally a one-line fix.

---

## Task 4 — Loading & error states

The products page shows "0 results found" while data is loading, and if the API call fails, nothing happens — the error just gets swallowed silently. Users have no idea what's going on.

- **A) Add `loading` and `error` state variables, show a spinner while loading and an error message if it fails**
  - simple and matches how the rest of the app handles this (the product detail page already has a spinner)
  - a bit repetitive if you had to do this on every page, but for one page it's fine

- **B) Write a custom hook (like `useFetch`) that handles loading/error/data for you**
  - cleaner and reusable — you just call `useFetch(url)` and get `{ data, loading, error }` back
  - but only one page needs this right now, so writing a whole hook feels premature
 
**My pick:** A with a spinner. Simple: track whether we're loading and whether something went wrong. While loading, show a spinning animation (the product detail page already has one, so I'll just reuse that same style). If the request fails, show a red error message so the user actually knows something broke instead of staring at a blank page.

There are libraries out there (like react-query) that handle all of this for you automatically — loading states, error handling, even caching so the page doesn't re-fetch data you already have. They're awesome for bigger apps. But installing a whole library for one page felt like bringing a firehose to water a houseplant.

I also thought about using a single status variable (like "idle" / "loading" / "error" / "success") instead of two separate true/false flags, which is technically cleaner because you can't end up in a weird state where loading and error are both true at the same time. But with just two flags on one page, that edge case basically never happens, so the simpler approach wins.

---

## Task 5 — Input validation

This overlaps with Tasks 1 and 2 — it's basically the validation part of those. The tests check that the server returns `400` with `{ error: "..." }` for bad input.

**Server side:**

- **A) Manual if-checks at the top of each route handler**
  - check if name is missing, check if variants array is empty, check if price is negative, etc. — return 400 with a message if anything's wrong
  - it's a bit repetitive but very readable and you control the exact error messages

- **B) Use a validation library like zod**
  - define the rules once as a schema, cleaner code
  - but adds a dependency and nobody else in the project uses it

**Client side:**

- **A) Check the fields manually on submit, show error messages under each field**
  - full control over what messages show where, no extra packages needed

- **B) Use HTML5 `required` and `min` attributes on the inputs, plus manual checks for anything the browser can't handle**
  - the browser handles the basics (empty fields, negative numbers) for free, and custom JS handles the rest like duplicate SKU checking

**My pick:** Server A + Client B.

On the server, I just check each field one by one at the top of the route — is the name empty? are there any variants? is the price negative? If anything's wrong, immediately send back a clear error message. The tests care specifically about getting the right error format back, so having full control over those messages matters.

On the client (the form the user actually sees), I use built-in browser validation as a first pass — for example, marking a field as "required" means the browser won't even let you submit the form if it's empty. That's free and catches the obvious stuff. Then on top of that, I do my own checks when the user clicks Submit to catch anything more specific.

I thought about writing a reusable validation helper function so I wouldn't repeat myself across routes, but there are only 2 routes that need validation. The time spent writing the helper would be about the same as just writing the checks directly.

Another idea was checking fields as the user fills them out (like showing an error right when you tab away from a field instead of waiting until you hit Submit). It gives faster feedback, which is nice, but it can also be annoying — like if you click into a field and then click out before typing anything, it would yell at you for leaving it empty even though you weren't done yet. Checking on submit is simpler and still catches everything.

---

## Bonus A — Double-submit on Delete

The delete button doesn't disable while the request is in-flight, so spam-clicking sends a bunch of DELETE requests.

- **A) Track a `deleting` boolean in state, disable the button while it's true**
  - 3 lines of code. button grays out, user knows something's happening, can't click again

- **B) Debounce or throttle the click handler**
  - prevents rapid fire but the button still *looks* clickable, which is confusing

**My pick:** A. When the user clicks Delete, immediately gray out the button so they can't click it again, then send the request. Once it finishes, redirect them back to the products list. That's it. The button being grayed out is also visual feedback that says "hey, something's happening, hang tight."

You could get fancy and actually cancel the network request mid-flight if somehow a second click gets through, but... if the button is already grayed out, there's no second click to worry about. That'd be solving a problem that doesn't exist anymore.

---

## Bonus B — Inconsistent error responses

Some routes return errors as plain text (`res.send("something went wrong")`), others return JSON (`res.json({ error: "..." })`). The frontend can't reliably parse errors because it doesn't know which format it's getting.

- **A) Find the routes that use `.send()` for errors and change them to `.json({ error: message })`**
  - quick and targeted, just a few find-and-replace changes

- **B) Add error-handling middleware in the Express app that catches all errors and always returns JSON**
  - future-proof since any new route's errors automatically get formatted
  - but you'd have to refactor existing routes to pass errors to `next()` instead of handling them inline, which they don't currently do

**My pick:** A. There are only about 4 places where this happens. I'll just find each one and swap it from plain text to JSON format. Five minute job.

The middleware approach (basically a catch-all safety net at the app level that makes sure every error response is JSON no matter what) is a great idea for bigger apps. But it would require changing how every route handles errors — right now they handle errors themselves, and you'd have to change them to pass errors up to the middleware instead. That's a lot of refactoring for 4 lines of code.

I also thought about writing a small helper function (like `sendError(res, 400, "Name is required")`) that always formats things consistently. It's a nice idea, but it only works if everyone on the team remembers to use it — someone could still just write the old way and reintroduce the bug. For a project this small, just fixing the 4 lines directly is the fastest and most reliable path.

---

## What I'd improve with more time

_What would you add, refactor, or fix if you had another couple of hours?_

- **Skeleton loading instead of a spinner** — Right now while the products page loads, you just see a spinning circle. A nicer approach is to show gray placeholder shapes where the product cards will eventually appear (like how Facebook or YouTube look when they're loading). It gives users an idea of what's coming instead of just a vague spinner. The product grid already has a fixed card layout, so the placeholder shapes would map naturally to that.

- **Debounce the search input** — Currently the search bar fires off a new request to the server on every single keystroke. So if you type "chicken" that's 7 separate API calls in rapid succession, most of which are useless. Debouncing means waiting for the user to stop typing for a short moment (like 300ms) before actually sending the request. Saves a ton of unnecessary server traffic, especially as the catalog grows.

- **Pagination** — Right now the products page loads every single product at once. That works fine with the current seed data (maybe 20-30 items), but if this catalog grew to hundreds or thousands of products, the page would get really slow. Pagination means only loading, say, 20 at a time and letting users click "Next" to see more. The backend query would need a LIMIT and OFFSET, and the frontend would need page controls.

- **Better error feedback for duplicate SKUs** — If you try to create a product and one of the variant SKUs already exists in the database, right now you just get a generic error message. Ideally the form would highlight the specific SKU field that caused the conflict and say something like "This SKU is already taken" right next to it, instead of a vague banner at the top. Would need the server to return more structured error info (like which field failed) rather than just a single error string.

- **Accessibility on inline editing** — The inline variant editing works fine visually, but it could be better for keyboard users and screen readers. Things like auto-focusing the first input when you click Edit, trapping focus within the editable row, and making sure the Save/Cancel buttons are reachable with Tab. Didn't prioritize this given the time constraint, but in a real product it matters.

---

## Anything else?

_Optional — anything you want the reviewer to know (e.g. bugs you noticed, improvements you'd suggest to the existing code, etc.)._

One thing i guess idek: the root `package.json` `postinstall` script causes infinite recursion on da Windows because `npm install` at the root triggers `postinstall`, which calls `npm install` again repeatedly. annoying, had to install ... in each subdirectory separately. The fix would be to either pass `--ignore-scripts` on the sub-installs or rename `postinstall` to something that only runs when explicitly called.

Also noticed `GET /api/products/:id` doesn't check `deleted_at`, so you can still fetch a soft-deleted product directly by ID even after fixing the list. idek prob intentional but worth flagging.
