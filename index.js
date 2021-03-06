const https = require('https');
const { send } = require('micro');
const parse = require('urlencoded-body-parser');

const TOKEN = process.env.SLACK_AUTH_TOKEN;

const digitEmoji = (d) => {
  const digit = parseInt(d, 10);
  const emoji = [
    ':zero:',
    ':one:',
    ':two:',
    ':three:',
    ':four:',
    ':five:',
    ':six:',
    ':seven:',
    ':eight:',
    ':nine:',
  ];
  return emoji[digit];
};

const numberEmoji = (number, duration) => Array.from(number.toString().padStart(duration.toString().length, '0')).map(digitEmoji).join('');

module.exports = async (req, res) => {
  const data = await parse(req);
  if (!data.text || !data.text.length) {
    send(res, 200, {
      text: 'Missing text',
    });
    return;
  }

  if (!data.text.match(/^\d+/)) {
    send(res, 200, {
      text: 'Missing duration, e.g. `/countdown 10` for a ten seconds countdown',
    });
    return;
  }

  send(res, 200);

  const [durationString, ...toParts] = data.text.split(' ');
  const duration = parseInt(durationString, 10);
  const to = toParts.join(' ');
  https.get(`https://slack.com/api/chat.postMessage?token=${TOKEN}&channel=${data.channel_id}&text=${encodeURIComponent(`<@${data.user_id}|${data.user_name}> started a *${duration} seconds* countdown to *${to || 'something'}*`)}&pretty=1`, () => {
    https.get(`https://slack.com/api/chat.postMessage?token=${TOKEN}&channel=${data.channel_id}&text=${encodeURIComponent(numberEmoji(duration, duration))}&pretty=1`, (cpres) => {
      cpres.setEncoding('utf8');
      let channel;
      let ts;
      let rawData = '';
      cpres.on('data', (chunk) => { rawData += chunk; });
      cpres.on('end', () => {
        const resData = JSON.parse(rawData);
        channel = resData.channel;
        ts = resData.ts;
        let iteration = 0;
        const interval = setInterval(() => {
          iteration += 1;
          if (iteration > duration) {
            clearInterval(interval);
            https.get(`https://slack.com/api/chat.postMessage?token=${TOKEN}&channel=${channel}&text=${encodeURIComponent(`<!here> :rocket: *${to || 'GO'}* :rocket:`)}&pretty=1`);
            return;
          }
          https.get(`https://slack.com/api/chat.update?token=${TOKEN}&channel=${channel}&text=${encodeURIComponent(numberEmoji(duration - iteration, duration))}&ts=${ts}&pretty=1`);
        }, 1000);
      });
    });
  });
};
