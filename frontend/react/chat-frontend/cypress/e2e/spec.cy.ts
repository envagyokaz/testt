/// <reference types="cypress" />

// describe('template spec', () => {
//   it('passes', () => {
//     cy.visit('https://example.cypress.io')
//   })
// })



describe("chat tests", () => {
//     it("should allow user to register, login and access chat", () => {
//
//         // Visit the registration page
//         cy.visit("http://10.5.0.50:5173/register");
//
//         // Fill in the registration form
//         const uniqueId = Date.now();
//         const email = "testuser" + uniqueId + "@example.com";
//         const username = "Test User " + uniqueId;
//         const password = "TestPassword123!";
//
//         cy.get('input[name="username"]').type(email); // Per mapping, username field is email
//         cy.get('input[name="email"]').type(username); // Per mapping, email field is username
//         cy.get('input[name="password"]').type(password);
//
//         // Submit the registration form
//         const registerButton = cy.contains("button", "Register");
//         registerButton.click();
//
//         // Wait for redirection to login page
//         cy.url().should("eq", "http://10.5.0.50:5173/");
//
//         // Fill in the login form with the same credentials
//         cy.get('input[name="username"]').type(email); // Per mapping, username field is email
//         cy.get('input[name="password"]').type(password);
//
//         // Submit the login form
//         cy.contains("button","Log In").click();
// //zsír
//         // Wait for redirection to chat page
//         cy.url().should("eq", "http://10.5.0.50:5173/chat");
//     });

    // it("should prevent access to chat without login", () => {
    //     // Clear localStorage to ensure no token is present
    //     cy.clearLocalStorage();
    //
    //     // Attempt to visit the chat page directly
    //     cy.visit("http://10.5.0.50:5173/chat");
    //
    //     // Verify that we are redirected to the login page
    //     cy.url().should("eq", "http://10.5.0.50:5173/");
    //
    // })


})


