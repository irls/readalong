# ReadAlong

HTML5 audio player and text highlighter for immersive audio accompaniment

This object is an adaptation of the work of Weston Ruter https://github.com/westonruter/html5-audio-read-along

My purpose was to abstract the functionality into a flexible, lightwight object to allow plugging functionality into modular framework-based applications. 

## Install

```npm install readalong --save```

## Use

```javascript

import ReadAlong from 'readalong'

// Assuming your HTML is set up to as blocks with data-audiosrc and words with data-map attributes like so:
<p id='a365' data-audiosrc="gospel-wealth-single.mp3"> 
  <w data-map="0,1315">The </w><w data-map="1315,1925">inevitable </w>
</p>

// Initialize the audio player
let ra = new ReadAlong()  

// start playing audio using block id
ra.playBlock('a365')  

// just for fun, tweak the speed every 5 seconds
setTimeout(() => { ra.changePlayRate(1) }, 5000) 
setTimeout(() => { ra.changePlayRate(.8) }, 10000) 
setTimeout(() => { ra.changePlayRate(1.2) }, 15000) 


```

## Test

This is a UI object, so the tests were just used for development.  






### Configuration Options

```javascript

// Configuration options. These are the defaults
let args = { 
  playbackRate: 1,
  prevOffsetTop: 0, 
  forceLineScroll: true,  
  keep_highlight_on_pause: true,
  highlight_trail: true
}
// Optional events you can hook into
let events = {
  on_pause: onAudioPause, // provides word, position, speed
  on_resume: onAudioResume,
  on_move: onAudioMove, // provides old position, new positions, speed
  on_start: onAudioStart, 
  on_complete: onAudioComplete, // provides id
  on_newline: onAudioNewline
} 
let ra = new ReadAlong(args, events)  
ra.playBlock('a365')  

```

### Notes about word-wrapping

The original ReadAlong implementation used a very verbose and DOM-based approach. Each word was wrapped in a span with data attributes specifying the start and length of that word.

I'm trying to make this as terse as possible since the my target is ebooks on mobile. So I'm wrapping each word in a custom "w" tag during initialization and keeping timing information in an indexed array keyed by block id. The "w" tag is not standard HTML which means it will not get in the way of any <span> tags you already use. But you can change this in the config object if you choose.

Also, I've switched the default storage to a single data-map attribute formatted as "begin,dur" and with integer ms instead of floating seconds. More natural to programming, I feel.


```html
<!-- #1 Original Readalong html format, (does not include audio src): -->
<p id='b31'>
  <span data-dur="0.154" data-begin="0.775">In</span> 
  <span data-dur="0.28" data-begin="0.929">those</span> 
  <span data-dur="0.29" data-begin="1.218">days</span> 
  <span data-dur="0.131" data-begin="1.508">a</span> 
  <span data-dur="0.525" data-begin="1.639">decree</span> 
  <span data-dur="0.191" data-begin="2.165">went</span> 
  <span data-dur="0.225" data-begin="2.355">out</span> 
  <span data-dur="0.245" data-begin="2.583">from</span> 
  <span data-dur="0.438" data-begin="2.828">Caesar</span>
</p>

<!-- #2 My slightly more terse format with block, uses integer ms instead of seconds -->  
<p id="b31" data-audiosrc="b31.mp3">
  <w data-map="775,154">In</w> 
  <w data-map="929,280">those</w> 
  <w data-map="1218,290">days</w> 
  <w data-map="1508,131">a</w> 
  <w data-map="1639,525">decree</w> 
  <w data-map="2165,191">went</w> 
  <w data-map="2355,225">out</w> 
  <w data-map="2583,245">from</w> 
  <w data-map="2828,438">Caesar</w>
</p>

```

 


