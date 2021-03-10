export class ApiError extends Error {
  httpResponse;

  constructor(message, httpResponse) {
    super(message);
    this.name = this.constructor.name;
    this.httpResponse = httpResponse;
  }
}

export class Api {
  login() {
    return this.post('http://localhost:3001/login');
  }

  logout() {
    return this.delete('http://localhost:3001/logout', {responseType: 'none'});
  }

  post(url, options) {
    const newOptions = {
      ...options,
      method: 'POST',
    };
    return this.request(url, newOptions);
  }

  delete(url, options) {
    const newOptions = {
      ...options,
      method: 'DELETE',
    };
    return this.request(url, newOptions);
  }

  async request(url, options) {
    const newOptions = {
      ...options,
      credentials: 'include',
    };
    if (options.responseType == null) {
      newOptions.responseType = 'json';
    }
    const res = await fetch(url, newOptions);
    if (res.status >= 200 && res.status < 300) {
      if (newOptions.responseType === 'json') {
        return res.json();
      } else {
        return null;
      }
    } else {
      throw new ApiError('HTTP error ' + res.status);
    }
  }
}
