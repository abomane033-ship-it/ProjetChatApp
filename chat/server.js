//initialisation de l'appli Express et permet de gérer les routes HTTP,Middlewares et les reponse serveur
const express = require('express');
const http = require('http');
const socket = require('socket.io');;
const path = require('path');
const fs = require('fs');
const app = express();
//creation d'un serveur http en utilisant le module natif de node.js
const  server = http.createServer(app);
//initialise Socket.io pour mettre pour mettre la communication en temps réel
const io = socket(server);
const multer = require('multer');
const upload = multer({dest:'uploads/'});
//crée une constante uploadDir contenantle chemin absolu vers un dossier "upload+s"
const uploadDir = path.join(__dirname,'uploads');
// Creation de dossier Uploads
if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
// Middleware statique
app.use('/uploads', express.static(path.join(__dirname,'uploads')));
app.post('/upload', upload.single('file'),(req, res) =>{
    res.json({
        name: req.file.originalname,
        path:'/uploads/${req.file.filename}'
    });
});
// Configuration
const PORT = process.env.PORT || 3000;
//stockage en memoire des messages et des groupes avec leurs membres
let messages = {};
let users = [];
let groups = {};
let calls = {};
// Configuration du moteur de templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
//Middleware pour les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
//route principale
app.get('/', (req, res) => {
    res.render('index', {title:'ChatApp'});
})
//gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté:', socket.id);

// gérer l'ajout d'un utilisateur
socket.on('add user', (username) => {
    if (username && !users.find(user => user.name === username)){
        const user = {
            id: socket.id,
            name: username
        };
        users.push(user);
        socket.username = username;
    };
});
//Envoyer la listes des utilisateurs à tous
io.emit('user list', users.map(u =>({id: u.id, name: u.name})));
// informer tous les clients qu'un utilisateur s'est connecté
socketIo.broadcast.emit('user joinned', {
    username: username,
    nomUsers: users.lenght
});
//confirmer à l'utilisateur qu'il est connecté
socketIo.emit('login',{
    numUsers: users.lenght
});
//Envoyer les messages précèdentes uniquement pour les groupes où l'utilisateur est membre
for(const [groupName, members] of Object.entries(groups)) {
    if (members.has(username)) {
        const messagesData = messages[groupName] ||[];
        socketIo.emit('previous messages', {
            conv: groupName,
            type: 'group',
            messages: messagesData
        });
        socketIo.join(groupName);
    }
//Envoyer les groupes où utilisateur est membre
const userGroups = Object.entries(groups)
    .filter(([_,members]) => members.has(username))
    .map(([groupName]) => groupName);
    socketIo.emit('groups', userGroups);
    
    console.log('${username} a rejoint le chat');
};
//gérer la création d'un groupe
socketIo.on('create group',(data) => {
    const {groupName, members } = data;
    if(!groupName || !members || !Array.isArray(members) || members.lenght < 1) {
        socketIo.emit('error', {message: 'Nom de groupe invalide ou le groupe est introuvable.'});
        return;
    }
    if(groups[groupName]) {
        socketIo.emit('error', {message: 'le Groupe que vous voulez créer existe déjà.'});
        return;
    }
// vérifier si tous les members sont des utilisateurs connectés
const validMembers = members.filter(member => users.some(user => user.name === member));
if(validMembers.lenght < 1) {
    socketIo.emit('error', {message: 'Aucun membre trouvé.'});
    return;
}
});
//ajouter le groupe avec unn set de membres
groups[groupName] = new Set([socketIo.username, ...validMembers]);
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
socketIo.join(groupName);
//notifier uniquement les members du groupe de sa crétion
groups[groupName].forEach(member => {
    const user = users.find(u => u.name === member);
    if(user){
        const memberGroups = Object.entries(groups)
        .filter(([_, members]) => members.has(member))
        .map(([_, groupName]) => groupName);
        io.to(user.id).emit('groups'.memberGroups);
    }
console.log('groupe ${groupName} crée avec: ${[...groups[groupName]].join(',')}');
});

//gerer les messages privés
socketIo.on('private message',(data) => {
    if(!socketIo.username || !data ||!data.message ||!data.to) return;
    const {message, to} = data;
    const convKey = [socketIo.username, to].sort().join('-');
    if(!messages[convKey]) messages[convKey] = [];
    const msg = {
        username: socketIo.username,
        message: message,
        timestamp: new Date().toLocaleTimeString()
    };
    messages[convKey].push(msg);

    const recipient = users.find(u => u.name === to);
    if (recipient) {
        io.to(recipient.id).emit('new message', {conv: convKey, message: msg});
    }
    console.log('Message privé de ${socket.username} à ${to}: ${message}');
});

// gérer les messages de groupe
socketIo.on('group message', (data) => {
    if(!socketIo.username || !data || !data.message || !data.to) return;

    const {message, to} = data;
    if(!groups[to] || !groups[to].has(socketIo.username)) return;

    const msg = {
        username: socketIo.username,
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

    console.log('Message de groupe de ${socket.username} dans ${to}: ${message}');
});

// gérer les fichiers
socketIo.on('send file',(data) => {
    if( !socketIo.username || !data.to || !data.file || !data.file.path) return;

    const filePath = path.join(__dirname, data.file.path);
    if(!fs.existsSync(filePath)) {
        console.error('Fichier introuvable: ${filePath}');
        socketIo.emit('error', {message: 'Fichier non trouvé sur le serveur.'});
        return;
    }

    const convKey = data.isGroup ? data.to : [socketIo.username, data.to].sort().join('-');
    const msg = {
        username: socketIo.username,
        file: data.file,
        timestamp: new Date().toLocaleTimeString(),
        type: 'file'
    };
    if(!messages[convKey]) messages[convKey] = [];
    messages[convKey].push(msg);
    if(data.isGroup){
        if(groups[convKey] && groups[convKey].has(socketIo.username)) {
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
socketIo.on('disconnect', () => {
    if(socketIo.username) {
        users = users.file(user => user.id !== socketIo.id);
        io.emit('user list', users.map(u => ({id: u.id, name: u.name})));
        socketIo.broadcast.emit('user left', {
            username: socket.username,
            numUsers: users.lenght
        });
        console.log('${socket.username} a quitté le chat');
    }
});

//gestion des appels video
socketIo.on('start call',(data) => {
    const { to, isGroup} = data;
    const callld = isGroup ? to: [socketIo.username, to].sort().join('-');
    if(!calls[callld]) {
        calls[callld] = {participants: new Set(), isGroup, to};
    }
    calls[callld].participants.add (socket.username);
    socketIo.join(callld);
    io.to(callld).emit('user joined call', {username: socketIo.username, callld});
    if(isGroup) {
        socketIo.to (to).emit('incoming call', {from: socketIo.username, callld, groupName: to});
    } else {
        const recipient = users.find(u => u.name === to);
        if(recipient) {
            io.to(recipient.id).emit('incoming call', {from: socketIo.username, callld, groupName: to});
        }
    }
    socketIo.emit('call started', {callld, isGroup});
});

socketIo.on('accept call', (data) => {
    const {callld} = data;
    if (calls[callld]) {
        calls[callld].participants.add(socketIo.username);
        socketIo.join(callld);
        io.to(callld).emit('user joined call', { username: socketIo.username, callld});
    }
});
socketIo.on('webrtc offer',(data) => {
    const{ to, offer, callld} = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit ('webrtc offer', {from: socketIo.username, offer,callld});
    }
});
socketIo.on('webrtc answer', (data) => {
    const{ to, answer, callld } = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit('webrtc answer', {from: socketIo.username, answer,callld});
    }
});
socketIo.on('ice candidate',(data) => {
    const {to, candidate, callld} = data;
    const recipient = users.find(u => u.name === to);
    if(recipient) {
        io.to(recipient.id).emit('ice candidate', {from: socketIo.username, candidate, callld});
    }
});
socketIo.on('leave call', (data) => {
    const {callld} = data;
    if(calls[callld]) {
        calls[callld].participants.delete(socketIo.username);
        socketIo.leave(callld);
        io.to(callld).emit('user left call', {username: socketIo.username, callld});
        if(calls[callld].participants.size === 0){
            delete calls[callld];
        }
    }
});
socketIo.on('update status', (data) =>{
    const {callld, audioEnabled, videoEnabled } = data;
    io.to(callld).emit('status update', { username: socketIo.username, audioEnabled, videoEnabled, callld});
});
socketIo.on('invite to call', (data) => {
    const { to, callld} = data;
    if(calls[callld] && calls[callld].participants.size < 8 && !calls[callld].participants.has(to)) {
        const recipient = users.find(u => u.name === to);
        if(recipient){
            io.to(recipient.id).emit('incoming call', {from: socketIo.username, callld, isGroup: calls[callld].isGroup, groupName: calls[callld].to});
        }
    }
});
socketIo.on('send sticker', (data) => {
    io.to(data.callld).emit('receive sticker',{
        sticker: data.sticker,
        from:data.from
    });
});
});
server.listen(PORT, '0.0.0.0',() => {
    console.log('server démaré sur http://localhost:${3000}');
});
