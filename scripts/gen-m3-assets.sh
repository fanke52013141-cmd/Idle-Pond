#!/bin/bash
set -u
KEY="${KEY:?need KEY}"
OUT="$(cd "$(dirname "$0")/../public/assets" && pwd)"
FF="/c/Users/Administrator/AppData/Local/Programs/FFmpeg/bin/ffmpeg.exe"
gen() {
  local RESP TASKID URL
  RESP=$(curl -s --max-time 30 -X POST "https://toapis.cn/v1/images/generations" \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "$(node -e "const p=process.argv[1];console.log(JSON.stringify({model:'gpt-image-2-vip',prompt:p,size:'1:1',resolution:'1k',quality:'low',n:1,response_format:'url',background:'transparent'}))" "$2")")
  TASKID=$(echo "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log((j.data||j).id||'ERR')}catch{console.log('ERR')}})")
  [ "$TASKID" = "ERR" ] && { echo "[$1] submit failed"; return 1; }
  for i in $(seq 1 50); do
    sleep 6
    R=$(curl -s --max-time 15 "https://toapis.cn/v1/images/generations/$TASKID" -H "Authorization: Bearer $KEY")
    ST=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const d=j.data||j;console.log(d.status||'?')}catch{console.log('err')}})")
    if [ "$ST" = "completed" ]; then
      URL=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const d=j.data||j;console.log(d.result.data[0].url)})")
      curl -s --max-time 60 -o "$OUT/$1-raw.png" "$URL"
      "$FF" -y -loglevel error -i "$OUT/$1-raw.png" -vf "scale=512:512" -pred mixed "$OUT/$1.png"
      rm -f "$OUT/$1-raw.png"
      echo "[$1] done"
      return 0
    fi
    [ "$ST" = "failed" ] && { echo "[$1] FAILED"; return 1; }
  done
  echo "[$1] timeout"
}
COMMON="soft painterly game-art style matching a tranquil Chinese pond illustration, seen from directly above in a perfectly top-down view, fully transparent background all around, no water, no shadow, no text"
gen turtle-a "A small pond turtle seen from directly above, olive-green domed shell with subtle geometric scute patterns, small head pointing up with tiny eyes, four little flippers spread, $COMMON"
gen turtle-b "A small pond turtle seen from directly above, darker mossy-green shell with faint algae texture, head pointing up, flippers gently paddling, $COMMON"
gen droplet "A single crystal-clear water droplet, round with bright specular highlights and slight blue-green refraction tint, glistening, $COMMON"
echo "ALL DONE"
