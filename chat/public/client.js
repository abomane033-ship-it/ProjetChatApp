const loginPage = document.getElementById('loginPage');
const chatPage = document.getElementById('chatPage'); 
const usernameInput = document.getElementById('usernameInput'); 
const loginBtn = document.getElementById('loginBtn'); 
const messageInput = document.getElementById('messageInput'); 
const sendBtn = document.getElementById('sendBtn'); 
const messagesContainer = document.getElementById('messages'); 
const chatList = document.getElementById('chat-list'); 
const userNameElement = document.getElementById('user-name'); 
const chatHeaderName = document.getElementById('chat-header-name'); 
const chatHeaderImg = document.getElementById('chat-header-img'); 
const searchInput = document.getElementById('search-input'); 
const newChatBtn = document.getElementById('new-chat-btn');
const voiceBtn = document.getElementById('voice-btn'); 
const attachBtn = document.getElementById('attach-btn'); 
const emojiBtn = document.getElementById('emoji-btn'); 
const phoneBtn = document.getElementById('phone-btn'); 
const videoBtn = document.getElementById('video-btn'); 
const videoCallBtn = document.getElementById('video-call-btn'); 
const settingsBtn = document.getElementById('settings-btn'); 
const socket = io();

let username = ''; 
let connected = false; 
let currentConv = null; 
let conversations = {}; 
let otherUsers = []; 
let groups = []; 
let userDefaultImage = 'images/default_user.png'; 
let mediaRecorder; 
let videoRecorder; 
let audioChunks = []; 
let videoChunks = []; 
let peerConnections = {}; 
let localStream; 
let currentCall = null; 
let participantsStatus = {}; 
let callTimerInterval;

const elements = { videoCallBtn, voiceBtn, messageInput }; 
console.log('Initialisation:', elements); 
if (!videoCallBtn) 
    console.error('Erreur : videoCallBtn non trouvé dans le DOM. Vérifiez l\'ID dans le HTML.'); 
if (!document.querySelector('#video-call-btn')) 
    console.error('Erreur : Aucun élément avec ID video-call-btn trouvé.');