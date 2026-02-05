/// <reference types="cypress" />

// describe('GET /users végpont tesztelése', () => {
//   it('visszaadja a felhasználók listáját', () => {
//     cy.request('GET', '/dogs')
//       .then((response) => {
//         expect(response.status).to.eq(200);
//         expect(response.body).to.be.an('array');
//         expect(response.body[0]).to.have.property('id');
//       });
//   });
// });

// describe('API fájlfeltöltés', () => {

//   it('feltölt egy fájlt multipart/form-data kéréssel', () => {

//     const fileName = 'cica.jpg'

//     cy.fixture(fileName, 'binary')
//       .then(Cypress.Blob.binaryStringToBlob)
//       .then((fileContent) => {

//         const formData = new FormData();
//         formData.append('avatar', fileContent, fileName);

//         cy.request({
//           method: 'POST',
//           url: '/user/avatar',
//           body: formData,
//           headers: {
//             'Content-Type': 'multipart/form-data',
//           }
//         }).then((response) => {
//           expect(response.status).to.eq(200)
//         })
//       })
//   })
// })

//////////////////////////////////////////////////////////////

describe("dog tests", () => {
  it("GET /dogs", () => {
    cy.request("GET", "/dogs").then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an("array");
    });
  });


  it("get dog by id", () => {
    const dogId = 2;
    cy.request("GET", `/dogs/${dogId}`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body[0]).to.have.property("id", dogId);
    });
  });

  it("get dog by invalid id", () => {
    const dogId = -1;
    cy.request({
      method: "GET",
      url: `/dogs/${dogId}`,
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(404);
    })
  });

  it("post new dog", () => {
    //12
    cy.request("POST", "/dogs", {
      name: "Bodri",
      breed: "keverék",
      isMale: 1,
      age: 4,
      picurl: "bodri.jpg",
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it("post with bad datas", ()=>{
    cy.request({
      method: "POST",
      url: "/dogs",
      failOnStatusCode: false,
      body: {
        name: "",
        breed: "keverék",
        isMale: 1,
        age: 4,
        picurl: "bodri.jpg",
      }
    }).then((response)=>{
      expect(response.status).to.eq(400);
    })
  })

  // it("Delete dog by id", () => {
  //   const dogIdToDelete = 12;
  //   cy.request("DELETE", `/dogs/${dogIdToDelete}`).then((response) => {
  //     expect(response.status).to.eq(204)
  //   })
  // })

  it("put dog by id", () => {
    const dogIdToUpdate = 1;
    cy.request("PUT", `/dogs/${dogIdToUpdate}`, {
      name: "Maximilian",
      breed: "Németjuhász-kuvasz keverék",
      isMale: 1,
      age: 4,
      picurl: "maxi.jpg",
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it("put with bad datas", ()=>{
    cy.request({
      method: "PUT",
      url: `/dogs/`,
      failOnStatusCode: false,
      body: {
        name: "",
        breed: "Németjuhász-kuvasz keverék",
        isMale: 1,
        age: 4,
        picurl: "maxi.jpg",
      }
    }).then((response)=>{
      expect(response.status).to.eq(404);
    })
  })

  it("patch dog by id", () => {
    const dogIdToPatch = 1;
    cy.request("PATCH", `/dogs/${dogIdToPatch}`, {
      age: 5,
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  
  it("patch with bad id", ()=>{
    cy.request({
      method :"PATCH",
      url:"/dogs/99999",
      failOnStatusCode: false,
      body:{
        age: 6,
        }
        }).then((response)=>{
          expect(response.status).to.eq(404);
          //timeout
    })
  })

  it("patch dog with wrong data", ()=>{
    cy.request({
      method: "PATCH",
      url:"/dogs/80",
      failOnStatusCode: false,
      body:{
        age: "hello",
      }
    }).then((response)=>{
      expect(response.status).to.eq(400);
      //timeout, sql error van, de nem 400 bad request
    })
  })
  




});


//-----------------------------------------------------------------------

describe("User-tests", () => {
  let token = "";
  it("POST /user/signin", () => {
    cy.request("POST", "/user/signin", {
      email: "teszt1@gmail.com",
      password: "titok",
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property("token");
      token = response.body.token;
    });
  });

  it("POST /user/signin with bad credentials", () => {
    cy.request({
      method: "POST",
      url: "/user/signin",
      failOnStatusCode: false,
      body: {
        email: "sanyi@en.com",
        password: "rosszjelszo",
      },
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  const randomNum = Math.floor(Math.random() * 10000);
  
  it("signup test", () => {
    cy.request("POST", "/user/signup", {
      email: "teszt" + randomNum + "@gmail.com",
      password: "titok",
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
    
  });

  it("test of signup test with existing email", () => {
    cy.request({
      method: "POST",
      url: "/user/signin",
      body: {
        email: "teszt" + randomNum + "@gmail.com",
        password: "titok",
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });

  it("signup test with worng data-email", () => {
    cy.request({
      method: "POST",
      url: "/user/signup",
      failOnStatusCode: false,
      body: {
        password: "titok",
      },
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });

  it("signup test with worng data -paswd", () => {
    cy.request({
      method: "POST",
      url: "/user/signup",
      failOnStatusCode: false,
      body: {
        email: "titok@nagyontitkos.sec",
      },
    }).then((response) => {
      expect(response.status).to.eq(500);
    });
  });
});
