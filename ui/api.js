import fetch from 'isomorphic-fetch';
//import { Schema, arrayOf, normalize } from 'normalizr';

const API_URI = '/api';
const AUTH_TOKEN = 'X-Auth-Token';

function getToken() {
  return window.localStorage.getItem(AUTH_TOKEN);
}

function setToken(token) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN, token);
  }
}

function deleteToken() {
  window.localStorage.removeItem(AUTH_TOKEN);
}

function makeURI(uri) {
  return `${API_URI}${uri}`;
}

export function getPhotos(page, orderBy) {
  return fetch(`${makeURI('/photos/')}?page=${page}&orderBy=${orderBy}`)
  .then(response => response.json());
}

export function getPhotoDetail(id) {
  const url  = `${makeURI('/photos/' + id)}`;
  return fetch(url, {
    headers: {
      [AUTH_TOKEN]: getToken()
  }})
  .then(response => response.json());
}

export function getUser() {
  const token = getToken();
  if (!token) {
    return new Promise(resolve => null);
  }

  return fetch(makeURI("/auth/"), {
    headers: {
      [AUTH_TOKEN]: getToken()
    }})
    .then(response => response.json())
}

export function logout() {
  deleteToken();
  fetch(makeURI("/auth/"), { method: "DELETE" });
}

export function login(identifier, password) {
  return fetch(makeURI("/auth/"), { 
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      identifier: identifier,
      password: password
    })
  })
  .then(response => {
    setToken(response.headers.get(AUTH_TOKEN));
    return response.json()
  });
}
