import React from "react";
import './App.css';
import {useState} from "react";
import {GamePage} from "./GamePage.js";
import {LoginPage} from "./LoginPage.js";
import {Api} from "./Api.js";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [session, setSession] = useState({
    user: null,
  });
  const api = new Api();

  return (
    <div className="App">
      {JSON.stringify(session)}
      {
        session.user ?
          <GamePage></GamePage>
          : <LoginPage api={api}
                       setSession={setSession}>
          </LoginPage>
      }
    </div>
  );
}

export default App;
