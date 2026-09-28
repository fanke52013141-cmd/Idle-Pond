#!/bin/bash
# M2 生物/荷花态精灵批量生成（toapis gpt-image-2-vip，1K/low/透明底）
# 用法: KEY=sk-xxx ./gen-m2-assets.sh
set -u
KEY="${KEY:?need KEY}"
OUT="$(cd "$(dirname "$0")/../public/assets" && pwd)"
FF="/c/Users/Administrator/AppData/Local/Programs/FFmpeg/bin/ffmpeg.exe"

gen() { # $1=name $2=prompt
  local RESP TASKID URL
  RESP=$(curl -s --max-time 30 -X POST "https://toapis.cn/v1/images/generations" \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "$(node -e "const p=process.argv[1];console.log(JSON.stringify({model:'gpt-image-2-vip',prompt:p,size:'1:1',resolution:'1k',quality:'low',n:1,response_format:'url',background:'transparent'}))" "$2")")
  TASKID=$(echo "$RESP" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log((j.data||j).id||'ERR')}catch{console.log('ERR')}})")
  if [ "$TASKID" = "ERR" ]; then echo "[$1] submit failed: $(echo "$RESP" | head -c 200)"; return 1; fi
  for i in $(seq 1 50); do
    sleep 6
    local R ST
    R=$(curl -s --max-time 15 "https://toapis.cn/v1/images/generations/$TASKID" -H "Authorization: Bearer $KEY")
    ST=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);const d=j.data||j;console.log(d.status||'?')}catch{console.log('err')}})")
    if [ "$ST" = "completed" ]; then
      URL=$(echo "$R" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const d=j.data||j;console.log(d.result.data[0].url)})")
      curl -s --max-time 60 -o "$OUT/$1-raw.png" "$URL"
      "$FF" -y -loglevel error -i "$OUT/$1-raw.png" -vf "scale=512:512" -pred mixed "$OUT/$1.png"
      rm -f "$OUT/$1-raw.png"
      echo "[$1] done ($TASKID)"
      return 0
    fi
    if [ "$ST" = "failed" ]; then echo "[$1] FAILED: $(echo "$R" | head -c 300)"; return 1; fi
  done
  echo "[$1] timeout"
  return 1
}

COMMON="soft painterly game-art style, seen from directly above in a perfectly top-down view, fully transparent background all around, no water, no shadow, no pond bottom, no text"

gen minnow-a "A tiny slender silver baitfish facing right, metallic silver body with a faint blue-green sheen along the back, translucent small tail fin, a tiny dark eye, $COMMON"
gen minnow-b "A tiny slender pale-golden baitfish facing right, translucent fins, a tiny dark eye, slightly rounder body than a minnow, $COMMON"
gen shrimp "A single small freshwater shrimp with translucent pale body showing subtle orange-pink segmentation, long thin antennae forward, small legs, curved back, $COMMON"
gen snail-a "A single small pond snail, spiral shell in warm brown with detailed whorls, soft grey-green body and two thin tentacles emerging at the front, $COMMON"
gen snail-b "A single small pond snail, spiral shell in olive green with darker spiral band, soft body and tentacles at the front, $COMMON"
gen strider "A single water strider insect, slender dark brown body, four very long thin legs spreading sideways with tiny dimple marks at the tips, $COMMON"
gen lotus-half "A pink lotus flower half open, outer petals spread flat while inner petals still raised and closed together, layered pale-pink petals with white bases, small golden center just visible, $COMMON"
gen lotus-bud "A closed pink lotus bud pointed upward, tight overlapping pale-pink petals with white base and a small green sepal at the bottom, $COMMON"
gen pellet "A single small round fish-food pellet, brown granule with slightly rough surface and subtle darker speckles, photorealistic detail, centered, $COMMON"
echo "ALL DONE"
