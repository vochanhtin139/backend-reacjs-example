const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcrypt');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');

const saltRounds = 10
const secret = 'asdfe45we45w345wegw345werjktjwertkj'

app.use(cors({credentials: true, origin: 'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser())
app.use('/uploads', express.static(__dirname + '/uploads'));

// const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
mongoose.connect("mongodb+srv://blog:1bkeoiOpaQoYs6Ug@cluster0.es057ru.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const userDoc = await User.create({ 
            username, 
            password: hashedPassword
        });
        res.json(userDoc);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
        console.log(e)
    }
});

app.post("/login", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const userDoc = await User.findOne({ username });
    const passOk = bcrypt.compare(password, userDoc.password);

    if (passOk) {
        jwt.sign({ username, id:userDoc._id }, secret, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json({
                id: userDoc._id,
                username
            })
        });
    }
    else {
        res.status(400).json({ error: "wrong crendetials" });
    }   
})

app.post("/profile", (req, res) => {
    const { token } = req.cookies;
    
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) throw err;
        res.json(info);
    })

    res.json(req.cookies);
});

app.post("/logout", (req, res) => {
    res.cookie('token', '').json('ok');
});

app.post("/post", uploadMiddleware.single('file'), async (req, res) => {
    const {originalname, path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext
    
    fs.renameSync(path, newPath);

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;

        const {title, summary, content} = req.body;

        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id
        });

        res.json(postDoc);
    });
})

app.get('/post', async (req, res) => {
    const posts = await Post.find().populate("author", ['username']).sort({createdAt: -1}).limit(20).exec();
    res.json(posts);
})

app.get('/post/:id', async (req, res) => {
    const id = req.params.id;
    const postDoc = await Post.findById(id).populate("author", ['username']).exec();
    res.json(postDoc);
})

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;

    if (req.file) {
        const {originalname, path} = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext
        
        fs.renameSync(path, newPath);
        req.body.cover = newPath;
    }

    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        
        const {id, title, summary, content} = req.body;

        const postDoc = await Post.findById(id).exec();
        console.log(postDoc)
        console.log(info)
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id)
        
        if (!isAuthor) {
            return res.status(400).json('you are not the author')
        }

        postDoc.title = title;
        postDoc.summary = summary;
        postDoc.content = content;
        postDoc.cover = newPath ? newPath : postDoc.cover;

        await postDoc.save();

        res.json(postDoc);
    });
})

app.listen(4000, () => {
    console.log("Server is running on port 4000");
});