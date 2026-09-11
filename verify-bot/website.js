const express = require("express");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chill Zone - Verify</title>

    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #0f1014;
            color: white;
            font-family: Arial, sans-serif;
        }

        .box {
            width: 380px;
            padding: 40px;
            text-align: center;
            background: #1b1d24;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,.5);
        }

        h1 {
            margin-bottom: 10px;
        }

        p {
            color: #b5bac1;
            line-height: 1.5;
        }

        .button {
            display: inline-block;
            margin-top: 20px;
            padding: 14px 25px;
            background: #5865f2;
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
        }

        .button:hover {
            background: #4752c4;
        }
    </style>
</head>

<body>

    <div class="box">
        <h1>🔐 Chill Zone</h1>

        <p>
            Willkommen auf der Chill Zone!
            <br><br>
            Verifiziere deinen Discord-Account,
            um Zugriff auf den Server zu erhalten.
        </p>

        <a class="button" href="/login">
            Mit Discord verifizieren
        </a>
    </div>

</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Website läuft auf http://localhost:${PORT}`);
});