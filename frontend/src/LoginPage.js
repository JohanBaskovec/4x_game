import React from "react";

const {useState} = require("react");

export function LoginPage(props) {
  const api = props.api;
  const setSession = props.setSession;
  const [error, setError] = useState(null);

  const submit = async () => {
    try {
      const res = await api.login();
      console.log(res);
      setSession({
        user: res.user,
      });
    } catch (e) {
      console.error(e);
      setError('Une erreur est survenue, veuillez réessayer ultérieurement.');
    }
  };

  submit();

  return (
    <div className="LoginForm">
      { error ? <div className="LoginForm__error">{error}</div> : <></>}
      <button type="button" onClick={submit}>Login</button>
    </div>);
}
