/* eslint-disable no-console */
import { readBlockConfig } from '../../scripts/aem.js';

function getCookieValue(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const cfg = readBlockConfig(block);

  // get sheet from block config
  let sheet = cfg.source;
  if (sheet === '') {
    sheet = '/okrs';
  }

  block.innerHTML = '';

  // preview the sheet so the latest data is accessible
  // wait for the preview to complete before proceeding to fetch the data
  const preview = new URL(`https://admin.hlx.page/preview/langswei/okrs/main${sheet}.json`);
  await fetch(preview, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }).then((response) => {
    if (response.status === 200) {
      // preview successful
      // TODO determine if we should publish next
    } else {
      console.log('Preview not successful.');
    }
  }).catch(() => {
    console.log('Preview not successful.');
  });

  // retrieve OKR data
  const okrs = new URL(`${window.location.protocol}//${window.location.host}${sheet}.json?sheet=OKRs&sheet=Categories&sheet=Metrics&sheet=Team`);

  fetch(okrs, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.json()).then((data) => {
    let output = '';

    // default date format yyyy-mm-dd
    const today = new Date().toISOString().split('T')[0];

    if (cfg.readonly !== 'true') {
      output += '<button id=\'showform\'>Add</button>';
    }

    output += `
        <div id='addform' class='content hide'>
            <label for='objective'>* Objective</label>
            <select id='objective' name='objective'>
                <option value=''>--Select One--</option>
    `;

    // output objectives
    data.OKRs.data.forEach((element) => {
      output += `<option value='${element.Objective}'>${element.Objective}</option>`;
    });

    output += `
            </select>
            <label for='category' class='hide'>* Category</label>
            <select id='category' name='category' class='hide'>
              <option value=''>--Select One--</option>
            </select>
            <label for='who'>* Who</label>
            <select id='who' name='who'>
                <option value=''>--Select One--</option>
    `;

    // output team members
    data.Team.data.forEach((element) => {
      output += `<option value='${element.Name}'>${element.Name}</option>`;
    });

    output += `
            </select>
            <label for='date'>* Date</label>
            <input id='date' name='date' type='date' value='${today}'>
            <label for='summary'>* Summary</label>
            <input id='summary' name='summary' value=''>
            <label for='notes'>Notes</label>
            <textarea id='notes' name="notes" cols="40" rows="5"></textarea>
            <button id='add'>Add</button>
            <button id='cancel'>Cancel</button>
        </div>
        <div id='results'></div>
    `;

    data.OKRs.data.forEach((element) => {
      // prepare subset of metrics data for the current objective in the loop
      const objArray = [];
      data.Metrics.data.forEach((metric) => {
        if (element.Objective === metric.Objective) {
          const obj = {};
          obj.Category = metric.Category;
          obj.Who = metric.Who;
          obj.Date = metric.Date;
          obj.Summary = metric.Summary;
          obj.Notes = metric.Notes;
          objArray.push(obj);
        }
      });

      // objective header
      const percent = (objArray.length * 100) / element['FY24 Target'];
      output += `
        <hr>
        <div class=objective>${element.Objective}</div>
        <div class=desc>${element.KR}</div>
        <div class=desc>${objArray.length} of ${element['FY24 Target']}</div>
        <div class='progressborder'>
            <div class='progressbar' style='width: ${percent}%'></div>
        </div>
      `;

      output += '<div class=container>';
      let headerDrawn = false;
      let i = 0;
      let row = '';
      objArray.forEach((metric) => {
        // only draw header row once
        if (!headerDrawn) {
          Object.keys(metric).forEach((field) => {
            output += `<div class=header>${field}</div>`;
          });
          headerDrawn = true;
        }

        // used for table highlights
        if (i % 2 === 0) {
          row = '';
        } else {
          row = ' odd';
        }
        i += 1;

        // display metrics data
        Object.values(metric).forEach((value) => {
          if (value) {
            output += `<div class='item${row}'>${value}</div>`;
          } else {
            output += `<div class='item${row}'>&nbsp;</div>`;
          }
        });
      });
      output += '</div>';
    });

    output += '<hr>';

    block.innerHTML = output;

    // handle form dynamic options.  added as new function in case form needs to expand.
    function createOptions(obj, value, elem) {
      obj.options.length = 1;
      data.Categories.data.forEach((element) => {
        if (element.Objective === value) {
          const options = document.createElement('option');
          options.value = options.text = element[elem];
          obj.add(options);
        }
      });
      (obj.options.length > 1) ? obj.classList.remove('hide') : obj.classList.add('hide');
    };

    // attach events
    if (cfg.readonly !== 'true') {
      block.querySelector('#showform').addEventListener('click', () => {
        block.querySelector('#showform').classList.add('hide');
        block.querySelector('#addform').classList.remove('hide');
      });
    }

    block.querySelector('#objective').addEventListener('change', () => {
      const elem = 'Category';
      const { value } = this;
      const cat = block.querySelector(`#${elem.toLowerCase()}`);
      createOptions(cat, value, elem);
    });

    block.querySelector('#cancel').addEventListener('click', () => {
      block.querySelector('#addform').classList.add('hide');
      block.querySelector('#showform').classList.remove('hide');
    });

    block.querySelector('#add').addEventListener('click', () => {
      // field validation
      const objective = block.querySelector('#objective').value;
      const category = block.querySelector('#category').value;
      const who = block.querySelector('#who').value;
      const date = block.querySelector('#date').value;
      const summary = block.querySelector('#summary').value;
      const notes = block.querySelector('#notes').value;

      if (!objective || !who || !date || !summary) {
        block.querySelector('#results').innerHTML = 'All fields marked with * are required.';
      } else {
        // disable fields while processing
        block.querySelector('#add').classList.add('hide');
        block.querySelector('#cancel').classList.add('hide');
        block.querySelector('#objective').disabled = 'disabled';
        block.querySelector('#category').disabled = 'disabled';
        block.querySelector('#who').disabled = 'disabled';
        block.querySelector('#date').disabled = 'disabled';
        block.querySelector('#summary').disabled = 'disabled';
        block.querySelector('#notes').disabled = 'disabled';
        block.querySelector('#results').innerHTML = 'Saving...';

        // create new domain key by making API request
        // const endpoint = new URL(`${window.location.protocol}//${window.location.host}${sheet}`);
        const endpoint = new URL(`https://form.aem.page/main--okrs--langswei${sheet}`);
        const body = {
          data: {
            Objective: objective,
            Category: category,
            Who: who,
            Date: date,
            Summary: summary,
            Notes: notes,
          },
        };

        const authToken = 'hlxtst_eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJva3JzLS1sYW5nc3dlaS5hZW0ucGFnZSIsInN1YiI6ImRrdW50emVAYWRvYmUuY29tIiwiZXhwIjoxNzQ0MTQ4MDY0fQ.fUj-lD5Sz5KMDpiMaoK7mnwrmvCFCVV8ZdCdrn5U_4SrTOqcO9CX70bsas1OuL7WZackHsT2GSUhaSciN2rh0bLSXr1JUdLT4ujUJ90CWmnrTi5yhmr9qysAncLKv1Fu7aOjGvUpiqhdlYTOP5CMfu__sfoDluyTcUdtyfyb0OxVdgi4_v_rMAeoyx3p_Y66Bd1hBvOigjGU9A6robd5e72DQTAwgbHDEO-yWOOHxv4wMlzHo1bSHZEP3ELPDA2V5ynKAKuY4ndENSNsqANgDw34izYWWHO7AjlMAtHwPjal8aCrWQPxqeJT2Dc_mve6NKRfc2LZX7BQzIv57Enjzg';

        fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `token ${authToken}`,
          },
        }).then((response) => {
          if (response.status === 201) {
            block.querySelector('#results').innerHTML = 'Saved.  It takes time for the data to be processed, please refresh page in one minute.';
          } else {
            block.querySelector('#results').innerHTML = 'Error, not saved.';
          }
        }).catch(() => {
          block.querySelector('#results').innerHTML = 'Error.';
        });
      }
    });
  }).catch((error) => {
    console.log(error);
    block.querySelector('#results').innerHTML = 'Error retrieving OKR data.';
  });
}
