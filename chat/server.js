//Importations des modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');

//configuration des systemes
const app = express();
const  server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 4000;

//création d'une constante uploadDir et Configuration du moteur de templates
const upload = multer({dest:'uploads/'});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.set('view engine', 'ejs');

//Middleware pour les fichiers statiques
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//stockage en memoire des messages et des groupes avec leurs membres
let messages = {};
let users = [];
let groups = {};
let calls = {};

//route principale
app.get('/', (req, res) => {
    res.render('index', {title:'ChatApp'});
});

//route upload
app.post('/upload', upload.single('file'), async (req, res) => {
  const fileData = {
    username: req.body.username,
    filename: req.file.originalname,
    path: `/uploads/${req.file.filename}`
  };
  const msg = new Message({
    conv: req.body.conv,
    username: req.body.username,
    message: req.file.originalname,
    type: 'file',
    file: fileData
  });
  await msg.save();
  res.json(fileData);
});

// Connetions Socket.IO
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté:', socket.id);

// Enregistrement d'un utilisateur
io.on('add user', async (username) => {
    socket.username = username;
    await User.findOneAndUpdate(
        {name: username},
        {socketId: socket.Id, status: 'online'},
        {upsert: true}
    );
});
    //gerer les messages privés
socket.on('private message',async (data) => {
    if(!socket.username || !data ||!data.message ||!data.to) return;
    const {message, to} = data;
    const convKey = [socket.username, to].sort().join('-');
    if(!messages[convKey]) messages[convKey] = [];
    const msg = new Message ({
        conv: convKey,
        username: socket.username,
        message,
        timestamp: new Date(),
        type: 'text'
    });
    await newMsg.save();
        messages[convKey].push(newMsg);

    const recipient = users.find(u => u.name === to);
    if (recipient) {
        io.to(recipient.id).emit('new message', {conv: convKey, message: newMsg});
    }
    console.log(`Message privé de ${socket.username} à ${to}: ${message}`);
    });

// gérer les messages de groupe
socket.on('group message', (data) => {
    if(!socket.username || !data || !data.message || !data.to) return;

    const {message, to} = data;
    if(!groups[to] || !groups[to].has(socket.username)) return;

    const msg = {
        username: socket.username,
        message: message,
        timestamp: new Date().toLocaleTimeString()
    };
    if(!messages[to]) messages[to] = [];
    messages[to].push(msg);
    groups[to].forEach(member => {
        const user = users.find(u => u.name === member);
        if (user){
            io.to(user.id).emit('new message', {conv: to, message: msg});
        }
    });
        console.log(`Message de groupe de ${socket.username} dans ${to}: ${message}`);
});
    //Envoyer la listes des utilisateurs à tous
    io.emit('user list', users.map(u =>({id: u.id, name: u.name})));
    // informer tous les clients qu'un utilisateur s'est connecté
    socket.broadcast.emit('user joinned', {
    username: username,
    nomUsers: users.length
    });
    //confirmer à l'utilisateur qu'il est connecté
    socket.emit('login',{
    numUsers: users.length
    });
    //Envoyer les messages précèdentes uniquement pour les groupes où l'utilisateur est membre
    for(const [groupName, members] of Object.entries(groups)) {
        if (members.has(username)) {
        const messagesData = messages[groupName] ||[];
        socket.emit('previous messages', {
            conv: groupName,
            type: 'group',
            messages: messagesData
        });
        socket.join(groupName);
    }
    //Envoyer les groupes où utilisateur est membre
    const userGroups = Object.entries(groups)
    .filter(([_,members]) => members.has(username))
    .map(([groupName]) => groupName);
    socket.emit('groups', userGroups);
    console.log(`${username} a rejoint le chat`);
    };
    //gérer la création d'un groupe
    socket.on('create group',(data) => {
    const {groupName, members } = data;
    if(!groupName || !members || !Array.isArray(members) || members.lenght < 1) {
        socket.emit('error', {message: 'Nom de groupe invalide ou le groupe est introuvable.'});
        return;
    }
    if(groups[groupName]) {
        socketIo.emit('error', {message: 'le Groupe que vous voulez créer existe déjà.'});
        return;
    }
    // vérifier si tous les members sont des utilisateurs connectés
    const validMembers = members.filter(member => users.some(user => user.name === member));
    if(validMembers.lenght < 1) {
    socket.emit('error', {message: 'Aucun membre trouvé.'});
    return;
        }
    });

    //ajouter le groupe avec un set de membres
    groups[groupName] = new Set([socket.username, ...validMembers]);
    messages[groupName] = [];
    // Faire rejoindre les membres au groupe
    validMembers.forEach(member => {
    const user = users.find(u => u.name === member);
    if(user) {
        io.to(user.id).emit('join group', {groupName});
        io.to(user.id).emit('group created', groupName);
        io.to(user.id).socketsJoin(groupName);
        }
    });
    // rejoindre le créateur au groupe
    socket.join(groupName);
    //notifier uniquement les members du groupe de sa crétion
    groups[groupName].forEach(member => {
    const user = users.find(u => u.name === member);
    if(user){
        const memberGroups = Object.entries(groups)
        .filter(([_, members]) => members.has(member))
        .map(([_, groupName]) => groupName);
        io.to(user.id).emit('groups'.memberGroups);
        }
    console.log(`groupe ${groupName} crée avec: ${[...groups[groupName]].join(',')}`);
    });

    // gérer les fichiers
    socket.on('send file',(data) => {
    if( !socket.username || !data.to || !data.file || !data.file.path) return;

    const filePath = path.join(__dirname, data.file.path);
    if(!fs.existsSync(filePath)) {
        console.error('Fichier introuvable: ${filePath}');
        socket.emit('error', {message: 'Fichier non trouvé sur le serveur.'});
        return;
    }

    const convKey = data.isGroup ? data.to : [socket.username, data.to].sort().join('-');
    const msg = {
        username: socket.username,
        file: data.file,
        timestamp: new Date().toLocaleTimeString(),
        type: 'file'
    };
    if(!messages[convKey]) messages[convKey] = [];
    messages[convKey].push(msg);
    if(data.isGroup){
        if(groups[convKey] && groups[convKey].has(socket.username)) {
            groups[convKey].forEach(member => {
                const recipient = users.find(u => u.name === member);
                if(recipient) {
                        io.to(recipient.id).emit('receive file', {conv: convKey, message: msg});
                    }
            });
        }
    } else {
        const recipient = users.find(u => u.name === data.to);
        if (recipient) {
            io.to(recipient.id).emit('receive file', {conv: convKey, message: msg});
        }
    }
});
// gérer la deconnexion
socket.on('disconnect', async () => {
    if (socket.username) {
      await User.findOneAndUpdate({ name: socket.username }, { status: 'offline' });
      console.log(`${socket.username} déconnecté`);
    }
  });

  //gestion des appels video
socket.on('start call',(data) => {
    const { to, isGroup} = data;
    const callId = isGroup ? to: [socket.username, to].sort().join('-');
    if(!calls[callId]) {
        calls[callId] = {participants: new Set(), isGroup, to};
    }
    calls[callId].participants.add (socket.username);
    socket.join(callId);
    io.to(callId).emit('user joined call', {username: socket.username, callId});
    if(isGroup) {
        socket.to(to).emit('incoming call', {from: socket.username, callId, isGroup:true, groupName: to});
    } else {
        const recipient = users.find(u => u.name === to);
        if(recipient) {
            io.to(recipient.id).emit('incoming call', {from: socket.username, callId, isGroup:false, groupName: to});
        }
    }
    io.emit('call started', {callId, isGroup});
});

socket.on('accept call', (data) => {
    const {callId} = data;
    if (calls[callId]) {
        calls[callId].participants.add(socket.username);
        socket.join(callId);
        io.to(callId).emit('user joined call', { username: socket.username, callId});
    }
});
socket.on('webrtc offer',(data) => {
    const{ to, offer, callId} = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit ('webrtc offer', {from: socket.username, offer, callId});
    }
});
socket.on('webrtc answer', (data) => {
    const{ to, answer, callId } = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit('webrtc answer', {from: socket.username, answer, callId});
    }
});
socket.on('ice candidate',(data) => {
    const {to, candidate, callId} = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit('ice candidate', {from: socket.username, candidate, callId});
    }
});
socket.on('leave call', (data) => {
    const {callId} = data;
    if(calls[callId]) {
        calls[callId].participants.delete(socket.username);
        socket.leave(callId);
        io.to(callId).emit('user left call', {username: socket.username, callId});
        if(calls[callId].participants.size === 0){
            delete calls[callId];
        }
    }
});
socket.on('update status', (data) =>{
    const {callId, audioEnabled, videoEnabled } = data;
    io.to(callId).emit('status update', { username: socket.username, audioEnabled, videoEnabled, callId});
});
socket.on('invite to call', (data) => {
    const { to, callId} = data;
    if(calls[callId] && calls[callId].participants.size < 8 && !calls[callId].participants.has(to)) {
        const recipient = users.find(u => u.name === to);
        if(recipient){
            io.to(recipient.id).emit('incoming call', {from: socket.username, callId, isGroup: calls[callId].isGroup, groupName: calls[callId].to});
        }
    }
});
socket.on('send sticker', (data) => {
    io.to(data.callId).emit('receive sticker',{
        sticker: data.sticker,
        from:data.from
    });
});

});

server.listen(PORT, '0.0.0.0',() => {
    console.log(`server démaré sur http://localhost:${4000}`);
});
