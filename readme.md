# ReadAlong

## Note: Project in progress. I expect to have this module actually working later this week

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
    word.data['begin'] = content.audiomap[id][i][j].start
    word.data['dur'] = content.audiomap[id][i][j].length
  }))
  return unparseHTML(sentences)
}

// Control the player
ra = new ReadAlong(options)
ra = myBlockInit   // block initialization based on your app
ra.start(block_id) // inits block & starts playing -- or resume if no id  
ra.stop()          // stop or pause
ra.resume()        // continue where we left off if possible

```

## Test

This is a UI object, so the tests were just used for development. To try out the module, check it out here:

Or using my jsfiddle:




### Configuration Options

```javascript

// Configuration options, all optional.
// Don't do too much processing between words. That would be bad
var options = {
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

### Notes about word-wrapping

The original ReadAlong implementation used a very verbose and DOM-based approach. Each word was wrapped in a span with data attributes specifying the start and length of that word.

I'm trying to make this as terse as possible since the my target is ebooks on mobile. So I'm wrapping each word in a custom "w" tag during initialization and keeping timing information in an indexed array keyed by block id.

```html
<!-- #1 Readalong html format: -->
<p id='b31'><span data-dur="0.154" data-begin="0.775">In</span> 
  <span data-dur="0.28" data-begin="0.929">those</span> 
  <span data-dur="0.29" data-begin="1.218">days</span> 
  <span data-dur="0.131" data-begin="1.508">a</span> 
  <span data-dur="0.525" data-begin="1.639">decree</span> 
  <span data-dur="0.191" data-begin="2.165">went</span> 
  <span data-dur="0.225" data-begin="2.355">out</span> 
  <span data-dur="0.245" data-begin="2.583">from</span> 
  <span data-dur="0.438" data-begin="2.828">Caesar</span></p>

<!-- #2 My terse format --> 
<p id='b31'><w>In</w> <w>those</w> <w>days</w> <w>a</w> <w>decree</w> 
<w>went</w> <w>out</w> <w>from</w> <w>Caesar</w></p>
```
```javascript
// Audiomap lookup object
map_lookup: {
  b31: [{begin:775, dur:154}, {begin:929, dur:280}, {begin:1218, dur:290}, {begin:1508, dur:131}, {begin:1639, dur:525}, {begin:2165, dur:191}, {begin:2355, dur:225}, {begin:2583, dur:245}, {begin:2828, dur:438}]
}
```

During initialization, an array of words is collected (as it is now). 

For lightweight storage, the map array is reduced to a compacted binary stream and stored with the block content like so:
```javascript 
{
  id:'b31', type:'par', classes:[], 
  content: 'In those days a decree went out from Caesar',
  map: 'luke2.mp3:0a8307809a811881228083820d80bf80e180f581b6'
}
```



