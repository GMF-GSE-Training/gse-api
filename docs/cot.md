# COT API Spec

## Create COT

Endpoint : POST /api/cot

Headers :

- Authorization : token

Request Body :

```json
{
    "kode_rating":

}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "uploads/participants/sim_a.png",
    "sim_b": "uploads/participants/sim_b.png",
    "ktp": "uploads/participants/ktp",
    "foto": "uploads/participants/foto",
    "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "uploads/participants/qr_code.png"
  }
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": ""
}
```

## Get All Participant

Endpoint : POST /api/participants

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": [
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "uploads/participants/sim_a.png",
      "sim_b": "uploads/participants/sim_b.png",
      "ktp": "uploads/participants/ktp",
      "foto": "uploads/participants/foto",
      "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "uploads/participants/qr_code.png"
    },
    {
      "no_pegawai": "12345",
      "name": "John Doe",
      "dinas": "TU",
      "bidang": "TLC-4",
      "perusahaan": "GMF",
      "email": "johndoe@gmail.com",
      "no_telp": "08123456789",
      "Kewarganegaraan": "Indonesia",
      "tempat_lahir": "Jakarta",
      "tanggal_lahir": "2024/01/01",
      "sim_a": "uploads/participants/sim_a.png",
      "sim_b": "uploads/participants/sim_b.png",
      "ktp": "uploads/participants/ktp",
      "foto": "uploads/participants/foto",
      "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
      "exp_surat_sehat": "2024/01/01",
      "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
      "exp_bebas_narkoba": "2024/01/01",
      "gmf_nongmf": "GMF",
      "link_qr_code": "https://example.com",
      "qr_code": "uploads/participants/qr_code.png"
    }
  ],
  "page": {
    "current_page": 1,
    "total_page": 10,
    "size": 100
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": ""
}
```

## Get Participant By Id

Endpoint : POST /api/participants/:participantId

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "uploads/participants/sim_a.png",
    "sim_b": "uploads/participants/sim_b.png",
    "ktp": "uploads/participants/ktp",
    "foto": "uploads/participants/foto",
    "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "uploads/participants/qr_code.png"
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": ""
}
```

## Update Participant

Endpoint : POST /api/participants/:participantId

Headers :

- Authorization : token

Request Body :

```json
{
  "no_pegawai": "12345, optional",
  "name": "John Doe, optional",
  "dinas": "TU, optional",
  "bidang": "TLC-4, optional",
  "perusahaan": "GMF, optional",
  "email": "johndoe@gmail.com, optional",
  "no_telp": "08123456789, optional",
  "Kewarganegaraan": "Indonesia, optional",
  "tempat_lahir": "Jakarta, optional",
  "tanggal_lahir": "2024/01/01, optional",
  "sim_a": "sim_a.jpg, optional",
  "sim_b": "sim_b.jpd, optional",
  "ktp": "ktp.jpg, optional",
  "foto": "foto.jpg, optional",
  "surat_sehat_buta_warna": "surat_sehat.jpg, optional",
  "exp_surat_sehat": "2024/01/01, optional",
  "surat_bebas_narkoba": "bebas_narkoba.jpg, optional",
  "exp_bebas_narkoba": "2024/01/01, optional",
  "gmf_nongmf": "GMF, optional"
}
```

Response Body (success) :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "uploads/participants/sim_a.png",
    "sim_b": "uploads/participants/sim_b.png",
    "ktp": "uploads/participants/ktp",
    "foto": "uploads/participants/foto",
    "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "uploads/participants/qr_code.png"
  }
}
```

Response Body (fail) :

```json
{
  "code": "400",
  "status": "BAD_REQUEST",
  "errors": ""
}
```

## Delete Participant

Endpoint : POST /api/participants/:participantId

Headers :

- Authorization : token

Response Body :

```json
{
  "code": "200",
  "status": "OK",
  "data": {
    "no_pegawai": "12345",
    "name": "John Doe",
    "dinas": "TU",
    "bidang": "TLC-4",
    "perusahaan": "GMF",
    "email": "johndoe@gmail.com",
    "no_telp": "08123456789",
    "Kewarganegaraan": "Indonesia",
    "tempat_lahir": "Jakarta",
    "tanggal_lahir": "2024/01/01",
    "sim_a": "uploads/participants/sim_a.png",
    "sim_b": "uploads/participants/sim_b.png",
    "ktp": "uploads/participants/ktp",
    "foto": "uploads/participants/foto",
    "surat_sehat_buta_warna": "uploads/participants/surat_sehat.png",
    "exp_surat_sehat": "2024/01/01",
    "surat_bebas_narkoba": "uploads/participants/bebas_narkoba.jpg",
    "exp_bebas_narkoba": "2024/01/01",
    "gmf_nongmf": "GMF",
    "link_qr_code": "https://example.com",
    "qr_code": "uploads/participants/qr_code.png"
  }
}
```

Response Body (fail) :

```json
{
  "code": "404",
  "status": "NOT_FOUND",
  "errors": ""
}
```

## Search Participant

Endpoint : GET api/users

Query Parameter :

- no_pegawai: string, optional
- name : string, name, optional
- email : string, participant email, optional
- phone : string, participant no_telp, optional
- dinas: string, participant dinas, optional,
- bidang: string, participant bidang, optional,
- perusahaan: string, participant perusahaan, optional,
- page : number, default 1
- size : number, default 10

Headers :

- Authorization : token

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
      "name": "Jogn Doe",
      "dinas": "TU",
      "role": 2
    },
    {
      "id": 2,
      "no_pegawai": "12345",
      "email": "johndoe@example.com",
      "name": "Jogn Doe",
      "dinas": "TU",
      "role": 3
    }
  ],
  "page": {
    "current_page": 1,
    "total_page": 10,
    "size": 100
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
