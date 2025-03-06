# User API Spec

## Create User

Endpoint : POST /users/create

Headers :

- Authorization : token

Request Body :

```json
{
  "no_pegawai": "12345, optional",
  "nik": "1234567890, optional",
  "email": "johndoe@example.com",
  "name": "John Doe",
  "password": "rahasia",
  "dinas": "TU, optional",
  "roleId": 1
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "roleId": 1,
    "no_peg": "12345",
    "token": "session_id_generated",
    "links": {
      "self": "/users/1",
      "update": "/users/1",
      "delete": "/users/1"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "500",
  "status": "SERVER_ERROR",
  "errors": ""
}
```

## Get User

Endpoint : GET /users/:userId

Headers :

- Authorization : token

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "no_pegawai": "12345",
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "roleId": 4,
    "no_peg": "12345",
    "links": {
      "self": "/users/1",
      "update": "/users/1",
      "delete": "/users/1"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "401",
  "status": "UNAUTHORIZED",
  "errors": ""
}
```

## List User

Endpoint : GET /users/list/result

Headers :

- Authorization : token

Query Parameter :

- paging : number, default 1
- size : number, default 10

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "id": 1,
      "no_pegawai": "12345",
      "email": "johndoe@example.com",
      "name": "John Doe",
      "dinas": "TU",
      "role": 2,
      "links": {
        "self": "/users/1",
        "update": "/users/1",
        "delete": "/users/1"
      }
    },
    {
      "id": 2,
      "no_pegawai": "54321",
      "email": "janedoe@example.com",
      "name": "Jane Doe",
      "dinas": "HR",
      "role": 3,
      "links": {
        "self": "/users/2",
        "update": "/users/2",
        "delete": "/users/2"
      }
    }
  ],
  "paging": {
    "current_page": 1,
    "total_page": 10,
    "size": 100,
    "links": {
      "next": "/users/list/result?page=2&size=10",
      "prev": null
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "403",
  "status": "FORBIDDEND",
  "errors": ""
}
```

## Update User

Endpoint : PATCH /users/:userId

Headers :

- Authorization : token

Request Body :

```json
{
  "no_peg": "12345, optional",
  "email": "johndoe@example.com, optional",
  "name": "John Doe, optional",
  "password": "rahasia, optional",
  "dinas": "TU, optional",
  "role": "super admin, optional"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "id": 1,
    "email": "johndoe@example.com",
    "name": "Jogn Doe",
    "dinas": "TU",
    "role": "super admin",
    "no_peg": "12345",
    "links": {
      "self": "/users/2",
      "update": "/users/2",
      "delete": "/users/2"
    }
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": {
    "id": [""],
    "name": [""]
  }
}
```

## Delete User

Endpoint : DELETE /users/:userId

Headers :

- Authorization : token

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": true
}
```

Response Body (fail) :

```json
{
  "code": "500",
  "status": "SERVER_ERROR",
  "errors": ""
}
```

## Search User

Endpoint : GET api/users/search/result

Headers :

- Authorization : token

Query Parameter :

- No Pegawai: string, user no_pegawai, optional
- email : string, user email, optional
- name : string, user name, optional
- phone : string, user no_telp, optional
- dinas: string, user dinas, optional,
- role: string, user role, optional,
- paging : number, default 1
- size : number, default 10

Request Header :

- X-API-TOKEN : token

Response Body (Success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "id": 1,
      "no_pegawai": "12345",
      "email": "johndoe@example.com",
      "name": "John Doe",
      "dinas": "TU",
      "role": 2,
      "links": {
        "self": "/users/1",
        "update": "/users/1",
        "delete": "/users/1"
      }
    },
    {
      "id": 2,
      "no_pegawai": "54321",
      "email": "janedoe@example.com",
      "name": "Jane Doe",
      "dinas": "HR",
      "role": 3,
      "links": {
        "self": "/users/2",
        "update": "/users/2",
        "delete": "/users/2"
      }
    }
  ],
  "paging": {
    "current_page": 1,
    "total_page": 10,
    "size": 100,
    "links": {
      "next": "/users/search/result?paging=2&size=10",
      "prev": null
    }
  }
}
```

Response Body (Failed) :

```json
{
  "code": "500",
  "status": "SERVER_ERROR",
  "errors": ""
}
```
