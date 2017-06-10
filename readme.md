# ReadAlong

HTML Read Along UI tool for immersive audio accompaniment

This library is an adaptation of the work of Weston Ruter https://github.com/westonruter/html5-audio-read-along

My purpose was to abstract the functionality a bit to allow plugging functionality into modular framework-based applications 

## Install

```npm install readalong --save```

## Use

```javascript

import ReadAlong from 'readalong'

// here's where you get your hands dirty, set up init to add your html blocks 
// this example parses into an array of sentences/words 
function myBlockInit(id, content) 
  let sentences = readalong.parseHTML( content.html[id] ) 
  sentences.forEach( (sentence, i) => sentence.forEach( (word, j) => {
    word.data['ra_start'] = content.audiomap[id][i][j].start
    word.data['ra_len'] = content.audiomap[id][i][j].length 
  }))
  return unparseHTML(sentences)
}

// Control the player
ra = new ReadAlong(config)
ra = myBlockInit   // block initialization based on your app
ra.start(block_id) // inits block & starts playing -- or resume if no id  
ra.stop()          // stop or pause
ra.resume()        // continue where we left off if possible

```

### Configuration Options

```javascript

// Configuration options, all optional
config = { 
  // events
  startedBlock: (block_id, time, audiofile) => {},
  finishedBlock: ((block_id, time, audiofile) => {}),
  stopped: ((block_id, block_completed) => {}),
  startedWord: ((word, prevword) => {}),
  finishedWord: ((word, nextword) => {}),
  // control
  autostart: true,
  autocontinue: true,
  playlist: [], // array of ids
  word_style: '', // highlight style of current playing word
  tail_style: '', // style of previous word (a tail smooths reading)
  tail_len: 0, // number of words in tail 
}

```


