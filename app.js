/* ═══════════════════════════════════════════════════════════════
   app.js — TOÀN BỘ LOGIC
   Phụ thuộc vào các biến khai báo trong data.js, nên phải nạp SAU data.js.
   ═══════════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyAxF7hj25lOR8QGhPMW1ie9_ZU1RsoCVL0",
  authDomain: "lmcl-rankings.firebaseapp.com",
  databaseURL: "https://lmcl-rankings-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lmcl-rankings",
  storageBucket: "lmcl-rankings.firebasestorage.app",
  messagingSenderId: "454282404352",
  appId: "1:454282404352:web:a6ead42afcd9c954c8aee5",
  measurementId: "G-TFFCH8D97K"
};
firebase.initializeApp(firebaseConfig);
const scoresRef = firebase.database().ref('scores');
const commentsRef = firebase.database().ref('comments');
const ratingsRef = firebase.database().ref('ratings');

// Quyền BTC do Firebase Authentication cấp. Tài khoản dùng chung một email cố định
// (email không phải bí mật), BTC chỉ cần nhập MẬT KHẨU — thao tác y như mã PIN cũ.
// Mật khẩu KHÔNG nằm trong mã nguồn, nên xem source cũng không sửa được điểm.
const BTC_EMAIL = "btc@lmcl.local";
const firebaseAuth = firebase.auth();

function showConnBanner(msg){
  const el = document.getElementById('conn-banner');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideConnBanner(){
  document.getElementById('conn-banner').style.display = 'none';
}

if(firebaseConfig.apiKey === 'YOUR_API_KEY' || firebaseConfig.projectId === 'YOUR_PROJECT'){
  showConnBanner('⚠️ Chưa cấu hình Firebase...');
}

let scores = {};
// Firebase tự nhớ phiên đăng nhập, không cần sessionStorage nữa.
// Có sửa biến này trong DevTools thì Security Rules vẫn chặn ghi dữ liệu.
let isAdmin = false;

const uiState = {
  all: { status: 'all', gender: 'all', day: 'all' }
};
const uiStateView = {
  nam: { status: 'all', day: 'all', search: '' },
  nu: { status: 'all', day: 'all', search: '' }
};

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let activeGroupTab = 'all';
let currentView = 'livematch';

/* =========================================
   ĐIỀU HƯỚNG THEO URL (path routing)
   ========================================= */
// Mỗi mục có link riêng dạng /members, /rankings, /tour/2026,
// /tour/2026/lmcl-jun-2026, /player/nguyen-dan-quyen — chia sẻ được,
// nút Back/Forward hoạt động đúng, và tải lại trang giữ nguyên đúng trang đang xem.
let applyingRoute = false;

function setRoute(path, opts){
  if(applyingRoute) return; // đang áp route từ URL vào giao diện, không tự đẩy thêm lịch sử
  opts = opts || {};
  try {
    history[opts.replace ? 'replaceState' : 'pushState'](null, '', '/' + path);
  } catch(e){ /* một số trình duyệt/khung nhúng chặn History API, bỏ qua cho an toàn */ }
}

// Đọc URL hiện tại rồi mở đúng trang tương ứng.
// Gọi khi: tải trang lần đầu, bấm nút Back/Forward, hoặc dán link trực tiếp.
function applyRouteFromHash(){
  // Link cũ dạng #members vẫn dùng được: đọc ra rồi đổi sang đường dẫn sạch
  let raw = location.pathname.replace(/^\/+|\/+$/g, '');
  const legacyHash = location.hash.replace(/^#\/?/, '');
  if(!raw && legacyHash){
    raw = legacyHash;
    try { history.replaceState(null, '', '/' + raw); } catch(e){}
  }

  const parts = raw.split('/').filter(Boolean);
  const seg = parts[0];

  applyingRoute = true;
  try {
    if(!seg || seg === 'livematch'){
      switchView('livematch', false);
      const grp = parts[1];
      if(grp && ['all', 'nam', 'nu', 'overall'].includes(grp) && grp !== activeGroupTab){
        const tabBtn = document.querySelector('.tab-btn[data-group="' + grp + '"]');
        if(tabBtn) tabBtn.click();
      }
    } else if(seg === 'members'){
      switchView('members', false);
    } else if(seg === 'rankings'){
      switchView('rankings', false);
    } else if(seg === 'tour'){
      // switchView chạy trước renderTourList: switchView('tour',...) tự gọi
      // showTourListView() bên trong nó, nếu renderTourList chạy trước sẽ bị
      // showTourListView() xoá mất bảng vừa tự mở (trường hợp mùa chỉ có 1 giải).
      const year = (parts[1] && TOUR_DATA[parts[1]]) ? parts[1] : DEFAULT_TOUR_YEAR;
      switchView('tour', false);
      renderTourList(year);
      const id = parts[2];
      if(id){
        const t = findTournament(id);
        if(t) showTourDetailView(t);
      }
    } else if(seg === 'player'){
      const key = parts[1];
      const row = key ? directoryRows().find(r => playerKey(r.name) === key) : null;
      if(row){
        openPlayerPage(row.name);
        const tab = parts[2];
        if(tab){
          const tabBtn = document.querySelector('.pp-tab[data-tab="' + tab + '"]');
          if(tabBtn) tabBtn.click();
        }
      } else {
        // Link hỏng hoặc VĐV không còn tồn tại — về trang mặc định thay vì màn hình trắng
        switchView('livematch', false);
      }
    } else {
      switchView('livematch', false);
    }
  } finally {
    applyingRoute = false;
  }
}

window.addEventListener('popstate', applyRouteFromHash);
const paintedStandings = { nam: null, nu: null, overall: null, rankings: null };
const ROW_ANIM_MS = 260;   
const STAGGER_MS = 65;     
const COUNT_MS = 650;      

function buildFixtures(group){
  const players = ROSTERS[group];
  const fixtures = [];
  for(let i = 0; i < players.length; i++){
    for(let j = i + 1; j < players.length; j++){
      fixtures.push({ id: group + '-' + i + '-' + j, p1: players[i], p2: players[j] });
    }
  }
  return fixtures;
}

const FIXTURES = { nam: buildFixtures('nam'), nu: buildFixtures('nu') };

function playerGroup(name){
  if(ROSTERS.nam.includes(name)) return 'nam';
  if(ROSTERS.nu.includes(name)) return 'nu';
  return null;
}


const ALL_FIXTURES = CUSTOM_MATCH_ORDER.map((pair, idx) => {
  const [nameA, nameB] = pair;
  const group = playerGroup(nameA);
  const roster = ROSTERS[group];
  const ia = roster.indexOf(nameA);
  const ib = roster.indexOf(nameB);
  const i = Math.min(ia, ib);
  const j = Math.max(ia, ib);
  return {
    id: group + '-' + i + '-' + j,
    p1: roster[i],
    p2: roster[j],
    group,
    day: idx < DAY1_COUNT ? 1 : 2
  };
});

function isEditingScoreInput(){
  const active = document.activeElement;
  return !!(active && active.tagName === 'INPUT' && active.classList.contains('score-input'));
}

let initialRouteApplied = false;

scoresRef.on('value', snapshot => {
  hideConnBanner();
  scores = snapshot.val() || {};
  if(isEditingScoreInput()) return;
  renderAll();
  renderReadonlyGroup('nam');
  renderReadonlyGroup('nu');
  ['nam','nu','overall','rankings'].forEach(refreshStandings);

  // Áp dụng đường link đang mở (ví dụ #player/...) sau khi có điểm số lần đầu,
  // để trang hồ sơ VĐV hiện đúng hạng/điểm ngay từ đầu thay vì phải chờ tải lại.
  if(!initialRouteApplied){
    initialRouteApplied = true;
    applyRouteFromHash();
  }
}, error => {
  showConnBanner('⚠️ Không kết nối được tới Firebase (' + error.message + ').');
  console.error('Firebase error:', error);
  // Firebase không phản hồi được thì vẫn mở đúng trang theo URL, dùng dữ liệu hiện có
  if(!initialRouteApplied){
    initialRouteApplied = true;
    applyRouteFromHash();
  }
});

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

const WIN_SCORE = 15;

function matchState(v1, v2){
  if(v1 === null && v2 === null){
    return { state: 'empty' };
  }
  if(v1 === null || v2 === null){
    return { state: 'invalid' };
  }
  if(v1 < 0 || v2 < 0){
    return { state: 'invalid' };
  }
  
  const hi = Math.max(v1, v2);
  const diff = Math.abs(v1 - v2);
  
  if(diff < 2 || hi < WIN_SCORE){
    return { state: 'invalid' };
  }
  
  return { state: 'finished' };
}

function getFilteredAllFixtures(){
  const searchEl = document.getElementById('search-all');
  const search = (searchEl ? searchEl.value : '').trim().toLowerCase();
  const status = uiState.all.status;
  const gender = uiState.all.gender;
  const day = uiState.all.day;
  return ALL_FIXTURES.filter(f => {
    if(day !== 'all' && String(f.day) !== day) return false;
    if(gender !== 'all' && f.group !== gender) return false;
    if(search){
      const hay = (f.p1 + ' ' + f.p2).toLowerCase();
      if(!hay.includes(search)) return false;
    }
    if(status !== 'all'){
      const sc = scores[f.id];
      const played = !!(sc && sc.played);
      if(status === 'played' && !played) return false;
      if(status === 'unplayed' && played) return false;
    }
    return true;
  });
}

// Thanh tiến độ: phần đã đấu / tổng số trận
function setProgress(id, done, total){
  const el = document.getElementById(id);
  if(!el) return;
  const pct = total ? Math.round((done / total) * 100) : 0;
  el.innerHTML =
    `<span class="progress-track"><span class="progress-fill" style="width:${pct}%"></span></span>` +
    `<span class="progress-num"><b>${done}</b>/${total}</span>`;
}

function renderAll(){
  renderAllFixtures();
}

// Dải nhắc chốt sổ: chỉ hiện khi ĐỦ trận VÀ đang ở quyền BTC.
// Người xem thường không thấy, và BTC có thể tự tắt trong phiên nếu thấy vướng.
let doneBannerDismissed = false;
function updateSeasonDoneBanner(done, total){
  const el = document.getElementById('season-done-banner');
  if(!el) return;
  const shouldShow = isAdmin && total > 0 && done >= total && !doneBannerDismissed;
  el.style.display = shouldShow ? '' : 'none';
  if(shouldShow){
    const cnt = document.getElementById('done-count');
    if(cnt) cnt.textContent = done + '/' + total;
  }
}

function renderAllFixtures(){
  const container = document.getElementById('fixtures-all');
  if(!container) return;
  const playedCount = ALL_FIXTURES.filter(f => scores[f.id] && scores[f.id].played).length;
  setProgress('progress-all', playedCount, ALL_FIXTURES.length);
  updateSeasonDoneBanner(playedCount, ALL_FIXTURES.length);

  const STATUS_LABEL = {
    finished: { text:'Đã đấu', cls:'done' },
    invalid: { text:'Tỷ số không hợp lệ', cls:'error' }
  };

  const visible = getFilteredAllFixtures();

  if(visible.length === 0){
    container.innerHTML = '<div class="no-results">Không tìm thấy trận đấu phù hợp</div>';
    return;
  }

  const disabledAttr = isAdmin ? '' : 'disabled';

  container.innerHTML = visible.map(f => {
    const idx = ALL_FIXTURES.indexOf(f);
    const sc = scores[f.id];
    const hasVal1 = sc && sc.s1 !== undefined && sc.s1 !== null;
    const hasVal2 = sc && sc.s2 !== undefined && sc.s2 !== null;
    const label = sc && STATUS_LABEL[sc.note] ? STATUS_LABEL[sc.note] : null;
    const isInvalid = sc && sc.note === 'invalid';
    const v1 = hasVal1 ? sc.s1 : null;
    const v2 = hasVal2 ? sc.s2 : null;
    const s1Winner = (v1 !== null && v2 !== null && v1 > v2) ? 'winner' : '';
    const s2Winner = (v1 !== null && v2 !== null && v2 > v1) ? 'winner' : '';
    return `<div class="fixture-row row-${f.group} ${sc && sc.played ? 'played' : ''}" data-id="${f.id}">
      <span class="fixture-num">${idx + 1}</span>
      <span class="name right" title="${escapeHtml(f.p1)}">${escapeHtml(f.p1)}</span>
      <input type="number" inputmode="numeric" min="0" class="score-input s1 ${isInvalid ? 'invalid' : s1Winner}" value="${hasVal1 ? sc.s1 : ''}" placeholder="-" ${disabledAttr}>
      <span></span>
      <input type="number" inputmode="numeric" min="0" class="score-input s2 ${isInvalid ? 'invalid' : s2Winner}" value="${hasVal2 ? sc.s2 : ''}" placeholder="-" ${disabledAttr}>
      <span class="name" title="${escapeHtml(f.p2)}">${escapeHtml(f.p2)}</span>
      <span class="error-msg"></span>
      <span class="fixture-status ${label ? label.cls : ''}">${label ? label.text : ''}</span>
    </div>`;
  }).join('');

  if(!isAdmin) return;

  container.querySelectorAll('.fixture-row').forEach(row => {
    const id = row.getAttribute('data-id');
    const s1input = row.querySelector('.s1');
    const s2input = row.querySelector('.s2');
    const errEl = row.querySelector('.error-msg');

    function updateWinnerHighlight(){
      const v1 = s1input.value === '' ? NaN : parseInt(s1input.value, 10);
      const v2 = s2input.value === '' ? NaN : parseInt(s2input.value, 10);

      s1input.classList.remove('winner');
      s2input.classList.remove('winner');

      if(!isNaN(v1) && !isNaN(v2) && v1 !== v2){
        if(v1 > v2) s1input.classList.add('winner');
        else s2input.classList.add('winner');
      }
    }

    function validateLive(){
      const v1 = s1input.value === '' ? null : parseInt(s1input.value, 10);
      const v2 = s2input.value === '' ? null : parseInt(s2input.value, 10);
      const result = matchState(v1, v2);
      
      if(result.state === 'invalid'){
        errEl.textContent = 'Tỷ số không hợp lệ';
        
        if(v1 !== null && v2 !== null){
          [s1input, s2input].forEach(inp => inp.classList.add('invalid'));
        } else {
          if(v1 === null || isNaN(v1)) s1input.classList.add('invalid');
          else s1input.classList.remove('invalid');

          if(v2 === null || isNaN(v2)) s2input.classList.add('invalid');
          else s2input.classList.remove('invalid');
        }

        [s1input, s2input].forEach(inp => {
          inp.classList.remove('shake');
          void inp.offsetWidth;
          inp.classList.add('shake');
        });
      } else {
        errEl.textContent = '';
        [s1input, s2input].forEach(inp => inp.classList.remove('invalid'));
      }

      updateWinnerHighlight();
    }

    [s1input, s2input].forEach(inp => {
      inp.addEventListener('animationend', () => inp.classList.remove('shake'));
      
      inp.addEventListener('focus', () => {
        setTimeout(() => {
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    });

    function commit(){
      const v1 = s1input.value === '' ? null : parseInt(s1input.value, 10);
      const v2 = s2input.value === '' ? null : parseInt(s2input.value, 10);
      let writeOp;
      if(v1 === null && v2 === null){
        writeOp = scoresRef.child(id).remove();
      } else {
        const result = matchState(v1, v2);
        writeOp = scoresRef.child(id).set({ s1: v1, s2: v2, played: result.state === 'finished', note: result.state });
      }
      writeOp.catch(error => {
        showConnBanner('⚠️ Lưu điểm thất bại (' + error.message + ').');
        console.error('Firebase write error:', error);
      });
    }

    s1input.addEventListener('input', validateLive);
    s2input.addEventListener('input', validateLive);

    s1input.addEventListener('change', () => {
      commit();
      if(document.activeElement !== s2input){
        s2input.focus();
        s2input.select();
      }
    });
    s2input.addEventListener('change', commit);

    s1input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        s2input.focus();
        s2input.select();
      }
    });
    s2input.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        e.preventDefault();
        s2input.blur();
      }
    });
  });
}

function renderReadonlyGroup(group){
  const container = document.getElementById('fixtures-view-' + group);
  if(!container) return;
  const fixtures = ALL_FIXTURES.filter(f => f.group === group);
  const playedCount = fixtures.filter(f => scores[f.id] && scores[f.id].played).length;
  setProgress('progress-view-' + group, playedCount, fixtures.length);

  const STATUS_LABEL = {
    finished: { text:'Đã đấu', cls:'done' },
    invalid: { text:'Tỷ số không hợp lệ', cls:'error' }
  };

  const state = uiStateView[group];
  const filtered = fixtures.filter(f => {
    if(state.day !== 'all' && String(f.day) !== state.day) return false;
    if(state.search){
      const hay = (f.p1 + ' ' + f.p2).toLowerCase();
      if(!hay.includes(state.search.toLowerCase())) return false;
    }
    if(state.status !== 'all'){
      const sc = scores[f.id];
      const played = !!(sc && sc.played);
      if(state.status === 'played' && !played) return false;
      if(state.status === 'unplayed' && played) return false;
    }
    return true;
  });

  if(filtered.length === 0){
    container.innerHTML = '<div class="no-results">Không tìm thấy trận đấu phù hợp</div>';
    return;
  }

  container.innerHTML = filtered.map(f => {
    const origIdx = fixtures.indexOf(f);
    const sc = scores[f.id];
    const hasVal1 = sc && sc.s1 !== undefined && sc.s1 !== null;
    const hasVal2 = sc && sc.s2 !== undefined && sc.s2 !== null;
    const isInvalid = sc && sc.note === 'invalid';
    const v1 = hasVal1 ? sc.s1 : null;
    const v2 = hasVal2 ? sc.s2 : null;
    const s1Winner = (!isInvalid && v1 !== null && v2 !== null && v1 > v2) ? 'winner' : '';
    const s2Winner = (!isInvalid && v1 !== null && v2 !== null && v2 > v1) ? 'winner' : '';
    const label = sc && STATUS_LABEL[sc.note] ? STATUS_LABEL[sc.note] : null;
    return `<div class="fixture-row ${sc && sc.played ? 'played' : ''}">
      <span class="fixture-num">${origIdx + 1}</span>
      <span class="name right" title="${escapeHtml(f.p1)}">${escapeHtml(f.p1)}</span>
      <span class="score-display ${isInvalid ? 'invalid' : s1Winner}">${hasVal1 ? sc.s1 : '-'}</span>
      <span></span>
      <span class="score-display ${isInvalid ? 'invalid' : s2Winner}">${hasVal2 ? sc.s2 : '-'}</span>
      <span class="name" title="${escapeHtml(f.p2)}">${escapeHtml(f.p2)}</span>
      <span class="fixture-status ${label ? label.cls : ''}">${label ? label.text : ''}</span>
    </div>`;
  }).join('');
}

function computeStandings(group){
  const table = {};
  ROSTERS[group].forEach(name => {
    table[name] = { name, played:0, win:0, loss:0, ptsFor:0, ptsAgainst:0 };
  });
  FIXTURES[group].forEach(f => {
    const sc = scores[f.id];
    if(!sc || !sc.played) return;
    const a = table[f.p1];
    const b = table[f.p2];
    a.played++; b.played++;
    a.ptsFor += sc.s1; a.ptsAgainst += sc.s2;
    b.ptsFor += sc.s2; b.ptsAgainst += sc.s1;
    if(sc.s1 > sc.s2){ a.win++; b.loss++; } else { b.win++; a.loss++; }
  });
  const rows = Object.values(table).map(r => ({ ...r, diff: r.ptsFor - r.ptsAgainst }));
  rows.sort((x, y) => {
    if(y.win !== x.win) return y.win - x.win;
    if(y.diff !== x.diff) return y.diff - x.diff;
    return y.ptsFor - x.ptsFor;
  });
  return rows;
}

function medalPointsFor(rankIndex){
  if(rankIndex === 0) return 3;
  if(rankIndex === 1) return 2;
  if(rankIndex === 2) return 1;
  return 0;
}

function computeOverall(){
  const medalMap = {};
  ['nam','nu'].forEach(group => {
    const fixtures = FIXTURES[group];
    const playedCount = fixtures.filter(f => scores[f.id] && scores[f.id].played).length;
    const isComplete = playedCount === fixtures.length;
    if(isComplete){
      computeStandings(group).forEach((r, i) => {
        medalMap[r.name] = medalPointsFor(i);
      });
    }
  });

  const withOldRank = OVERALL_DATA.map((r, i) => ({
    name: r.name,
    oldPoints: r.points,
    oldRank: i + 1
  }));

  const withNew = withOldRank.map(r => {
    const medal = medalMap[r.name] || 0;
    return { ...r, medal, newTotal: r.oldPoints + medal };
  });

  // Số huy chương cả sự nghiệp (mọi mùa/giải), dùng để phân định khi bằng điểm.
  // Ai nhiều Vàng hơn xếp trên; bằng Vàng thì xét tới Bạc, rồi Đồng — kiểu Olympic.
  const medalsByName = {};
  withNew.forEach(r => { medalsByName[r.name] = playerAchievements(r.name).medals; });

  const ranked = [...withNew].sort((a, b) => {
    if(b.newTotal !== a.newTotal) return b.newTotal - a.newTotal;
    const ma = medalsByName[a.name], mb = medalsByName[b.name];
    if(mb.gold   !== ma.gold)   return mb.gold   - ma.gold;
    if(mb.silver !== ma.silver) return mb.silver - ma.silver;
    return mb.bronze - ma.bronze;
  });
  ranked.forEach((r, i) => {
    r.newRank = i + 1;
    r.change = r.oldRank - r.newRank;
  });

  return ranked;
}

// Bảng Rankings ở menu dùng chung dữ liệu và bố cục với tab Rankings của Live Match,
// chỉ khác phần tử DOM được vẽ vào, nên 'rankings' được quy về 'overall'.
function normGroup(group){
  return group === 'rankings' ? 'overall' : group;
}

function getRowsFor(group){
  return normGroup(group) === 'overall' ? computeOverall() : computeStandings(group);
}

function rowScoreValue(group, r){
  return normGroup(group) === 'overall' ? r.newTotal : r.ptsFor;
}

function getRankBadgeHtml(rank){
  if(rank === 1) return `<span class="rank-badge rank-1" title="Hạng 1">1</span>`;
  if(rank === 2) return `<span class="rank-badge rank-2" title="Hạng 2">2</span>`;
  if(rank === 3) return `<span class="rank-badge rank-3" title="Hạng 3">3</span>`;
  return `<span class="rank-badge">${rank}</span>`;
}

function buildStandingsRowHtml(group, r, idx){
  const kind = normGroup(group);
  const rank = kind === 'overall' ? r.newRank : (idx + 1);
  const badgeHtml = getRankBadgeHtml(rank);

  if(kind === 'overall'){
    let changeCls = 'rank-same';
    let changeText = '–';
    if(r.change > 0){ changeCls = 'rank-up'; changeText = '▲ +' + r.change; }
    else if(r.change < 0){ changeCls = 'rank-down'; changeText = '▼ ' + r.change; }
    return `<tr data-name="${escapeHtml(r.name)}">
      <td>${badgeHtml}</td>
      <td>${escapeHtml(r.name)}</td>
      <td class="total-pts"><span class="count-val">${r.newTotal}</span></td>
      <td class="rank-change ${changeCls}">${changeText}</td>
    </tr>`;
  }
  return `<tr data-name="${escapeHtml(r.name)}">
    <td>${badgeHtml}</td>
    <td>${escapeHtml(r.name)}</td>
    <td>${r.played}</td>
    <td>${r.win}</td>
    <td>${r.loss}</td>
    <td><span class="count-val">${r.ptsFor}</span></td>
    <td>${r.ptsAgainst}</td>
    <td class="${r.diff > 0 ? 'diff-pos' : (r.diff < 0 ? 'diff-neg' : '')}">${r.diff > 0 ? '+' : ''}${r.diff}</td>
  </tr>`;
}

function paintTable(group, rows, opts){
  opts = opts || {};
  const forceEntrance = !!opts.forceEntrance;
  const tbody = document.getElementById('standings-' + group);
  if(!tbody) return;

  const prev = paintedStandings[group];
  const prevIndex = {};
  const prevScore = {};
  if(prev){
    prev.order.forEach((name, i) => { prevIndex[name] = i; });
    Object.assign(prevScore, prev.scoreByName);
  }

  tbody.innerHTML = rows.map((r, i) => buildStandingsRowHtml(group, r, i)).join('');

  const newSnapshot = { order: rows.map(r => r.name), scoreByName: {} };
  rows.forEach(r => { newSnapshot.scoreByName[r.name] = rowScoreValue(group, r); });

  if(REDUCE_MOTION){
    paintedStandings[group] = newSnapshot;
    return;
  }

  const trs = Array.from(tbody.querySelectorAll('tr[data-name]'));
  if(trs.length === 0){ paintedStandings[group] = newSnapshot; return; }

  const rowHeight = trs[0].getBoundingClientRect().height || 34;
  const items = [];

  trs.forEach((tr, newIdx) => {
    const name = tr.getAttribute('data-name');
    const oldIdx = prev ? prevIndex[name] : undefined;
    const hasMoved = !!prev && oldIdx !== undefined && oldIdx !== newIdx;
    const oldScoreVal = prev ? prevScore[name] : undefined;
    const newScore = newSnapshot.scoreByName[name];
    const scoreIncreased = !!prev && oldScoreVal !== undefined && newScore > oldScoreVal;
    const needsEntrance = forceEntrance || !prev;

    if(!needsEntrance && !hasMoved && !scoreIncreased) return;

    const delay = needsEntrance ? newIdx * STAGGER_MS : 0;
    let ty = 0;
    if(hasMoved) ty += (oldIdx - newIdx) * rowHeight;
    if(needsEntrance) ty += 6;

    tr.style.transition = 'none';
    tr.style.transform = ty !== 0 ? `translateY(${ty}px)` : '';
    tr.style.opacity = needsEntrance ? '0' : '1';

    items.push({ tr, oldIdx, newIdx, hasMoved, scoreIncreased, oldScoreVal, newScore, delay });
  });

  void tbody.offsetHeight;

  requestAnimationFrame(() => {
    items.forEach(item => {
      item.tr.style.transition =
        `transform ${ROW_ANIM_MS}ms ease ${item.delay}ms, opacity ${ROW_ANIM_MS}ms ease ${item.delay}ms`;
      item.tr.style.transform = '';
      item.tr.style.opacity = '1';
    });
  });

  items.forEach(item => {
    if(!item.hasMoved) return;
    setTimeout(() => {
      // Lên hạng = sáng xanh, xuống hạng = sáng đỏ
      item.tr.classList.add(item.newIdx < item.oldIdx ? 'rk-up-glow' : 'rk-down-glow');
    }, item.delay);
  });

  items.forEach(item => {
    if(!item.scoreIncreased) return;
    const target = item.tr.querySelector('.count-val');
    if(!target) return;
    const start = item.oldScoreVal;
    const end = item.newScore;
    const startTime = performance.now() + item.delay;
    function tick(now){
      if(now < startTime){ requestAnimationFrame(tick); return; }
      const p = Math.min(1, (now - startTime) / COUNT_MS);
      const eased = 1 - Math.pow(1 - p, 2);
      target.textContent = Math.round(start + (end - start) * eased);
      if(p < 1) requestAnimationFrame(tick);
      else target.textContent = end;
    }
    requestAnimationFrame(tick);
  });

  paintedStandings[group] = newSnapshot;
}

function refreshStandings(group){
  if(group === 'rankings'){
    if(currentView !== 'rankings' || rankingsSelection !== 'live') return;
    paintTable('rankings', getRowsFor('rankings'), { forceEntrance: false });
    return;
  }
  if(activeGroupTab !== group) return;
  paintTable(group, getRowsFor(group), { forceEntrance: false });
}

function openStandingsTab(group){
  paintTable(group, getRowsFor(group), { forceEntrance: true });
}

// Event Listeners
(() => {
  const searchBtnAll = document.getElementById('search-toggle-all');
  const searchWrapAll = document.getElementById('search-wrap-all');
  const searchInputAll = document.getElementById('search-all');

  if (searchBtnAll && searchWrapAll && searchInputAll) {
    searchBtnAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = searchWrapAll.classList.toggle('open');
      searchBtnAll.classList.toggle('active', isOpen);
      if (isOpen) searchInputAll.focus();
    });
    searchInputAll.addEventListener('input', () => renderAllFixtures());
  }

  const filterBtnAll = document.getElementById('filter-toggle-all');
  const filterMenuAll = document.getElementById('filter-menu-all');

  if (filterBtnAll && filterMenuAll) {
    filterBtnAll.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = filterMenuAll.classList.toggle('open');
      filterBtnAll.classList.toggle('active', isOpen);
    });

    filterMenuAll.querySelectorAll('button[data-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dim = btn.getAttribute('data-filter');
        const val = btn.getAttribute('data-value');
        uiState.all[dim] = val;

        filterMenuAll.querySelectorAll(`button[data-filter="${dim}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const hasFilter = uiState.all.status !== 'all' || uiState.all.gender !== 'all' || uiState.all.day !== 'all';
        filterBtnAll.classList.toggle('has-filter', hasFilter);

        filterMenuAll.classList.remove('open');
        filterBtnAll.classList.remove('active');
        renderAllFixtures();
      });
    });

    const resetAllBtn = document.getElementById('filter-reset-all');
    if(resetAllBtn){
      resetAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uiState.all.day = 'all';
        uiState.all.status = 'all';
        uiState.all.gender = 'all';

        // Đưa lại đúng nút "Tất cả" của cả 3 mục về trạng thái sáng
        ['day', 'status', 'gender'].forEach(dim => {
          filterMenuAll.querySelectorAll(`button[data-filter="${dim}"]`).forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-value') === 'all');
          });
        });

        filterBtnAll.classList.remove('has-filter');
        filterMenuAll.classList.remove('open');
        filterBtnAll.classList.remove('active');
        renderAllFixtures();
      });
    }
  }

  ['nam', 'nu'].forEach(group => {
    const searchBtn = document.getElementById('search-toggle-view-' + group);
    const searchWrap = document.getElementById('search-wrap-view-' + group);
    const searchInput = document.getElementById('search-view-' + group);

    if (searchBtn && searchWrap && searchInput) {
      searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = searchWrap.classList.toggle('open');
        searchBtn.classList.toggle('active', isOpen);
        if (isOpen) searchInput.focus();
      });
      searchInput.addEventListener('input', () => {
        uiStateView[group].search = searchInput.value.trim();
        renderReadonlyGroup(group);
      });
    }

    const filterBtn = document.getElementById('filter-toggle-view-' + group);
    const filterMenu = document.getElementById('filter-menu-view-' + group);

    if (filterBtn && filterMenu) {
      filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = filterMenu.classList.toggle('open');
        filterBtn.classList.toggle('active', isOpen);
      });

      filterMenu.querySelectorAll('button[data-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const dim = btn.getAttribute('data-filter');
          const val = btn.getAttribute('data-value');
          uiStateView[group][dim] = val;

          filterMenu.querySelectorAll(`button[data-filter="${dim}"]`).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const hasFilter = uiStateView[group].status !== 'all' || uiStateView[group].day !== 'all';
          filterBtn.classList.toggle('has-filter', hasFilter);

          filterMenu.classList.remove('open');
          filterBtn.classList.remove('active');
          renderReadonlyGroup(group);
        });
      });
    }
  });
})();

document.addEventListener('click', () => {
  ['all', 'view-nam', 'view-nu'].forEach(id => {
    const filterMenu = document.getElementById('filter-menu-' + id);
    const filterBtn = document.getElementById('filter-toggle-' + id);
    if (filterMenu && filterMenu.classList.contains('open')) {
      filterMenu.classList.remove('open');
      if (filterBtn) filterBtn.classList.remove('active');
    }
  });
});

const authToggleBtn = document.getElementById('auth-toggle-btn');
const pinModal = document.getElementById('pin-modal');
const pinInput = document.getElementById('pin-input');
const pinError = document.getElementById('pin-error');
const pinCancelBtn = document.getElementById('pin-cancel-btn');
const pinSubmitBtn = document.getElementById('pin-submit-btn');

// Banner nhắc BTC chỉ là lời chào lúc vào quyền: hiện 4 giây rồi tự mờ đi.
// Viền đứt ở các ô còn trống vẫn ở lại làm dấu hiệu lâu dài.
let adminBannerTimers = [];
function flashAdminBanner(show){
  const banner = document.querySelector('.admin-banner');
  if(!banner) return;
  adminBannerTimers.forEach(clearTimeout);
  adminBannerTimers = [];
  banner.style.display = '';
  banner.classList.remove('fading');
  if(!show) return;
  adminBannerTimers.push(setTimeout(() => banner.classList.add('fading'), 4000));
  adminBannerTimers.push(setTimeout(() => { banner.style.display = 'none'; }, 4400));
}

function updateAuthUI() {
  const navLoginLabel = document.getElementById('nav-login-label');
  const wasAdmin = document.body.classList.contains('admin-mode');
  document.body.classList.toggle('admin-mode', isAdmin);
  if (isAdmin) {
    if (!wasAdmin) flashAdminBanner(true);
    authToggleBtn.classList.add('is-admin');
    authToggleBtn.setAttribute('title', 'Đang ở quyền BTC (Bấm để thoát)');
    if (navLoginLabel) navLoginLabel.textContent = 'Đăng xuất (Đang là BTC)';
  } else {
    flashAdminBanner(false);
    authToggleBtn.classList.remove('is-admin');
    authToggleBtn.setAttribute('title', 'Kích hoạt quyền BTC');
    if (navLoginLabel) navLoginLabel.textContent = 'Đăng nhập BTC';
  }
  renderAll();
}

function showAuthError(msg){
  pinError.textContent = msg;
  pinError.style.display = 'block';
}

authToggleBtn.addEventListener('click', () => {
  if (isAdmin) {
    firebaseAuth.signOut().catch(err => console.error('Đăng xuất lỗi:', err));
  } else {
    pinInput.value = '';
    pinInput.classList.remove('err');
    pinError.style.display = 'none';
    pinBusy = false;
    setPinBtnState('idle');
    pinModal.classList.add('open');
    setTimeout(() => pinInput.focus(), 50);
  }
});

// Nguồn sự thật duy nhất về quyền BTC
firebaseAuth.onAuthStateChanged(user => {
  isAdmin = !!user;
  updateAuthUI();
});

pinCancelBtn.addEventListener('click', () => {
  pinModal.classList.remove('open');
});

const infoModal = document.getElementById('info-modal');
const infoCloseBtn = document.getElementById('info-close-btn');
const infoToggleNam = document.getElementById('info-toggle-nam');
const infoToggleNu = document.getElementById('info-toggle-nu');

function openInfoModal(){
  infoModal.classList.add('open');
}
function closeInfoModal(){
  infoModal.classList.remove('open');
}

if (infoToggleNam) infoToggleNam.addEventListener('click', openInfoModal);
if (infoToggleNu) infoToggleNu.addEventListener('click', openInfoModal);
infoCloseBtn.addEventListener('click', closeInfoModal);

infoModal.addEventListener('click', (e) => {
  if (e.target === infoModal) closeInfoModal();
});

// Trạng thái nút Xác nhận: bình thường → đang kiểm tra → thành công
const PIN_BTN_LABEL = pinSubmitBtn.textContent.trim();
function setPinBtnState(state){
  pinSubmitBtn.classList.remove('loading', 'ok');
  if(state === 'loading'){
    pinSubmitBtn.disabled = true;
    pinSubmitBtn.classList.add('loading');
    pinSubmitBtn.innerHTML = '<span class="btn-spinner"></span>Đang kiểm tra...';
  } else if(state === 'ok'){
    pinSubmitBtn.disabled = true;
    pinSubmitBtn.classList.add('ok');
    pinSubmitBtn.innerHTML = '&#10003; Thành công';
  } else {
    pinSubmitBtn.disabled = false;
    pinSubmitBtn.textContent = PIN_BTN_LABEL;
  }
}

function shakeModal(){
  const box = pinModal.querySelector('.modal-box');
  if(!box) return;
  box.classList.remove('shake');
  void box.offsetWidth;
  box.classList.add('shake');
  setTimeout(() => box.classList.remove('shake'), 500);
}

let pinBusy = false;

function verifyPin() {
  if(pinBusy) return;                       // chặn bấm liên tục
  const pass = pinInput.value;
  if(!pass){
    showAuthError('Bạn chưa nhập mã BTC');
    pinInput.classList.add('err');
    shakeModal();
    pinInput.focus();
    return;
  }

  pinBusy = true;
  pinInput.classList.remove('err');
  pinError.style.display = 'none';
  setPinBtnState('loading');

  // Giữ trạng thái "đang kiểm tra" tối thiểu 350ms để người dùng kịp thấy phản hồi
  const started = Date.now();
  const holdThen = fn => {
    const wait = Math.max(0, 350 - (Date.now() - started));
    setTimeout(fn, wait);
  };

  firebaseAuth.signInWithEmailAndPassword(BTC_EMAIL, pass)
    .then(() => {
      holdThen(() => {
        setPinBtnState('ok');
        setTimeout(() => {
          pinModal.classList.remove('open');
          pinInput.value = '';
          pinError.style.display = 'none';
          setPinBtnState('idle');
          pinBusy = false;
        }, 500);
      });
    })
    .catch(err => {
      const map = {
        'auth/wrong-password':        'Mã BTC không chính xác!',
        'auth/invalid-credential':    'Mã BTC không chính xác!',
        'auth/user-not-found':        'Chưa tạo tài khoản BTC trên Firebase',
        'auth/invalid-email':         'Email BTC trong code chưa đúng',
        'auth/too-many-requests':     'Sai quá nhiều lần, đợi một lát rồi thử lại',
        'auth/network-request-failed':'Không có mạng, thử lại sau',
        'auth/operation-not-allowed': 'Chưa bật Email/Password trong Firebase'
      };
      holdThen(() => {
        setPinBtnState('idle');
        showAuthError(map[err.code] || ('Đăng nhập thất bại (' + err.code + ')'));
        pinInput.value = '';
        pinInput.classList.add('err');
        shakeModal();
        pinInput.focus();
        pinBusy = false;
      });
    });
}

pinInput.addEventListener('input', () => {
  pinInput.classList.remove('err');
  pinError.style.display = 'none';
});

pinSubmitBtn.addEventListener('click', verifyPin);
pinInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') verifyPin();
});

/* =========================================
   PLAYER DIRECTORY (MEMBERS)
   ========================================= */
// Avatar mặc định khi VĐV chưa có ảnh
const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

let memberFilter = 'all';
let memberProvince = 'all';
let memberSearch = '';

// Cờ Việt Nam vẽ sẵn để không phụ thuộc ảnh ngoài; các cờ khác dùng URL trong dữ liệu.
const VN_FLAG_SVG = `<svg class="pd-flag" viewBox="0 0 30 20" role="img" aria-label="Việt Nam"><rect width="30" height="20" fill="#DA251D"/><polygon fill="#FFFF00" points="15,4.2 16.72,9.5 22.3,9.5 17.79,12.78 19.51,18.08 15,14.8 10.49,18.08 12.21,12.78 7.7,9.5 13.28,9.5"/></svg>`;

function oneFlagHtml(f, alt){
  if(!f) return '';
  if(f === 'vn') return VN_FLAG_SVG;
  return `<img class="pd-flag" src="${escapeHtml(f)}" alt="${escapeHtml(alt || '')}">`;
}

// Hỗ trợ nhiều lá cờ: dùng info.flags (mảng) hoặc info.flag (một lá)
function flagHtml(info){
  if(!info) return '';
  const list = Array.isArray(info.flags) ? info.flags : (info.flag ? [info.flag] : []);
  if(list.length === 0) return '';
  const inner = list.map(f => oneFlagHtml(f, info.nation)).join('');
  return list.length > 1 ? `<span class="flag-pair">${inner}</span>` : inner;
}

// Quê quán dùng cho bộ lọc; ai không có quê quán thì lấy tên quốc gia
function provinceOf(info){
  if(!info) return '';
  return info.hometown || info.nation || '';
}

function allProvinces(){
  const set = new Set();
  ['nam', 'nu'].forEach(g => {
    Object.values(MEMBERS_DATA[g] || {}).forEach(info => {
      const p = provinceOf(info);
      if(p) set.add(p);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

function locationText(info){
  if(!info) return '—';
  const parts = [info.hometown, info.nation].filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq.length ? uniq.join(', ') : '—';
}

// Danh sách VĐV kèm thứ hạng, xếp theo bảng LMCL Rankings mới nhất.
function directoryRows(){
  const rankOf = {};
  const ptsOf = {};
  computeOverall().forEach(r => {
    rankOf[r.name] = r.newRank;
    ptsOf[r.name] = r.newTotal;
  });

  const rows = [];
  ['nam', 'nu'].forEach(group => {
    ROSTERS[group].forEach(name => {
      rows.push({
        name,
        group,
        info: (MEMBERS_DATA[group] && MEMBERS_DATA[group][name]) || {},
        rank: rankOf[name],
        points: ptsOf[name]
      });
    });
  });

  // Có hạng lên trước (theo thứ hạng), chưa có hạng xuống cuối
  rows.sort((a, b) => {
    if(a.rank === undefined && b.rank === undefined) return a.name.localeCompare(b.name, 'vi');
    if(a.rank === undefined) return 1;
    if(b.rank === undefined) return -1;
    return a.rank - b.rank;
  });

  // Gắn nhãn MVP: đứng đầu toàn đội, đứng đầu nam, đứng đầu nữ
  const ranked = rows.filter(r => r.rank !== undefined);
  const topOverall = ranked[0];
  const topMen = ranked.find(r => r.group === 'nam');
  const topWomen = ranked.find(r => r.group === 'nu');
  rows.forEach(r => { r.tags = []; });
  if(topOverall) topOverall.tags.push({ key: 'team', label: 'MVP' });
  if(topMen) topMen.tags.push({ key: 'ms', label: "Men's MVP" });
  if(topWomen) topWomen.tags.push({ key: 'ws', label: "Women's MVP" });

  return rows;
}

// Tách tên: phần đầu nhỏ ở trên, tên gọi (chữ cuối) viết lớn bên dưới
function splitName(full){
  const parts = full.trim().split(/\s+/);
  return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

function renderMembers(){
  const grid = document.getElementById('pd-grid');
  if(!grid) return;

  const q = memberSearch.trim().toLowerCase();
  const rows = directoryRows().filter(r => {
    if(memberFilter !== 'all' && r.group !== memberFilter) return false;
    if(memberProvince !== 'all' && provinceOf(r.info) !== memberProvince) return false;
    if(q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });

  if(rows.length === 0){
    grid.innerHTML = '<div class="pd-empty">Không tìm thấy vận động viên phù hợp</div>';
    return;
  }

  grid.innerHTML = rows.map((r, i) => {
    const info = r.info;
    const nm = splitName(r.name);
    const rankTxt = r.rank === undefined ? '–' : '#' + r.rank;
    const rankCls = r.rank >= 1 && r.rank <= 3 ? ' top-' + r.rank : '';
    const photo = info.photo
      ? `<div class="pd-photo-bg" style="background-image:url('${escapeHtml(info.photo)}')"></div>
         <img src="${escapeHtml(info.photo)}" alt="${escapeHtml(r.name)}" loading="lazy">`
      : DEFAULT_AVATAR_SVG;
    return `<article class="pd-card" data-player="${escapeHtml(r.name)}" style="animation-delay:${i * 45}ms">
      <div class="pd-photo">${photo}${(r.tags && r.tags.length) ? `<span class="pd-mvp">${r.tags.map(t => `<b class="mvp-${t.key}">${t.label}</b>`).join('')}</span>` : ''}</div>
      <div class="pd-body">
        <div class="pd-namerow">
          <div class="pd-namecol">
            ${nm.given ? `<span class="pd-given">${escapeHtml(nm.given)}</span>` : ''}
            <h3 class="pd-family">${escapeHtml(nm.family)}</h3>
          </div>
          <span class="pd-rankchip${rankCls}">${rankTxt}</span>
        </div>
        <div class="pd-loc">${flagHtml(info)}<span>${escapeHtml(locationText(info))}</span></div>
        <button type="button" class="pd-more" data-player="${escapeHtml(r.name)}">SEE PLAYER PROFILE</button>
      </div>
    </article>`;
  }).join('');

  // Bấm bất kỳ đâu trên card cũng mở hồ sơ, có nhún nhẹ trước khi mở
  grid.querySelectorAll('.pd-card').forEach(card => {
    card.addEventListener('click', () => {
      const name = card.getAttribute('data-player');
      if(REDUCE_MOTION){ openPlayerPage(name); return; }
      card.classList.remove('tapped');
      void card.offsetWidth;
      card.classList.add('tapped');
      setTimeout(() => {
        card.classList.remove('tapped');
        openPlayerPage(name);
      }, 200);
    });
  });
}

// Thanh tìm kiếm + nút lọc của Player Directory
function buildMemberFilterMenu(){
  const menu = document.getElementById('pd-filter-menu');
  if(!menu) return;
  const provinces = allProvinces();
  menu.innerHTML =
    `<div class="pd-fm-label">Nội dung</div>
     <button type="button" data-dim="group" data-value="all" class="active">Tất cả</button>
     <button type="button" data-dim="group" data-value="nam">Nam</button>
     <button type="button" data-dim="group" data-value="nu">Nữ</button>
     <div class="pd-fm-divider"></div>
     <div class="pd-fm-label">Quê quán</div>
     <button type="button" data-dim="province" data-value="all" class="active">Tất cả</button>` +
    provinces.map(p => `<button type="button" data-dim="province" data-value="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join('') +
    `<div class="pd-fm-divider"></div>
     <button type="button" class="pd-filter-reset" id="pd-filter-reset">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
       Xoá bộ lọc
     </button>`;
}

(() => {
  const search = document.getElementById('pd-search');
  if(search){
    search.addEventListener('input', () => {
      memberSearch = search.value;
      renderMembers();
    });
  }

  const btn = document.getElementById('pd-filter-btn');
  const menu = document.getElementById('pd-filter-menu');
  if(!btn || !menu) return;

  buildMemberFilterMenu();

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = menu.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
  });

  menu.addEventListener('click', e => {
    // Nút xoá bộ lọc: đặt lại cả 2 mục cùng lúc
    if(e.target.closest('#pd-filter-reset')){
      e.stopPropagation();
      memberFilter = 'all';
      memberProvince = 'all';
      ['group', 'province'].forEach(dim => {
        menu.querySelectorAll(`button[data-dim="${dim}"]`).forEach(x => {
          x.classList.toggle('active', x.getAttribute('data-value') === 'all');
        });
      });
      btn.classList.remove('has-filter');
      menu.classList.remove('open');
      btn.classList.remove('active');
      renderMembers();
      return;
    }

    const b = e.target.closest('button[data-dim]');
    if(!b) return;
    e.stopPropagation();
    const dim = b.getAttribute('data-dim');
    const val = b.getAttribute('data-value');
    if(dim === 'group') memberFilter = val;
    else memberProvince = val;

    menu.querySelectorAll(`button[data-dim="${dim}"]`).forEach(x => x.classList.remove('active'));
    b.classList.add('active');

    btn.classList.toggle('has-filter', memberFilter !== 'all' || memberProvince !== 'all');
    menu.classList.remove('open');
    btn.classList.remove('active');
    renderMembers();
  });

  document.addEventListener('click', () => {
    if(menu.classList.contains('open')){
      menu.classList.remove('open');
      btn.classList.remove('active');
    }
  });
})();

/* ─── Thành tích tự tổng hợp từ dữ liệu các giải ────────────────────────── */
const EVENT_VI = { ms: 'Đơn Nam', ws: 'Đơn Nữ', md: 'Đôi Nam', wd: 'Đôi Nữ', xd: 'Đôi Nam Nữ' };
const MEDAL_BY_RANK = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const MEDAL_VI = { gold: 'Huy chương Vàng', silver: 'Huy chương Bạc', bronze: 'Huy chương Đồng' };

// Icon huy chương (dải ruy băng + mặt huy chương có ngôi sao)
const MEDAL_ICON = `<svg class="pm-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 1.8h3.1l2.2 4.6-2.6 1.2L6.6 1.8zm10.8 0h-3.1l-2.2 4.6 2.6 1.2 2.7-5.8z" opacity="0.75"/><circle cx="12" cy="15.6" r="6.4"/><path d="M12 11.9l1.05 2.15 2.37.34-1.71 1.66.4 2.36L12 17.29l-2.11 1.12.4-2.36-1.71-1.66 2.37-.34L12 11.9z" fill="#1a1a1a" opacity="0.45"/></svg>`;

// Icon cho thứ hạng trên bảng xếp hạng
const RANK_ICON = `<svg class="pm-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="20" x2="6" y2="13"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="18" y1="20" x2="18" y2="9"></line></svg>`;

// Top 3 của một hạng mục: ưu tiên thứ hạng ghi sẵn, nếu không thì tính từ kết quả trận
function eventTop3(ev){
  if(ev.finalRanking){
    return ev.finalRanking
      .filter(r => r.rank <= 3)
      .map(r => ({ rank: r.rank, players: ev.teams[r.t] }));
  }
  if(ev.matches && ev.matches.length){
    return computeEventStandings(ev)
      .slice(0, 3)
      .map((r, i) => ({ rank: i + 1, players: r.pair }));
  }
  return [];
}

function playerAchievements(name){
  const medals = { gold: 0, silver: 0, bronze: 0 };
  const groups = [];

  Object.keys(TOUR_DATA).sort((a, b) => b - a).forEach(year => {
    (TOUR_DATA[year] || []).forEach(t => {
      const when = t.badge || t.name;
      const items = [];

      // Huy chương từng hạng mục
      Object.keys(t.events || {}).forEach(key => {
        eventTop3(t.events[key]).forEach(pos => {
          if(!pos.players.includes(name)) return;
          const medal = MEDAL_BY_RANK[pos.rank];
          medals[medal]++;
          items.push({ kind: medal, label: EVENT_VI[key] || key.toUpperCase(), note: MEDAL_VI[medal] });
        });
      });

      // Thứ hạng top 3 trên bảng xếp hạng của mùa/giải
      if(t.standings){
        const idx = t.standings.findIndex(r => r.name === name);
        if(idx >= 0 && idx < 3){
          items.push({ kind: 'rank', label: 'Bảng xếp hạng', note: 'Hạng ' + (idx + 1) });
        }
      }

      if(items.length) groups.push({ when, items });
    });
  });

  return { medals, groups };
}

function achievementsHtml(name){
  const { medals, groups } = playerAchievements(name);
  if(groups.length === 0){
    return '<p class="pm-none">Chưa có thành tích trong top 3</p>';
  }

  const tally = `<div class="ach-tally">` +
    ['gold', 'silver', 'bronze'].map(k => `<div class="ach-stat ${k}">
        ${MEDAL_ICON}
        <b>${medals[k]}</b>
        <span>${k === 'gold' ? 'Vàng' : (k === 'silver' ? 'Bạc' : 'Đồng')}</span>
      </div>`).join('') + `</div>`;

  const body = groups.map(g => `<div class="ach-group">
      <h5>${escapeHtml(g.when)}</h5>
      <ul>${g.items.map(it => `<li class="${it.kind}">
        ${it.kind === 'rank' ? RANK_ICON : MEDAL_ICON}
        <span class="ach-label">${escapeHtml(it.label)}</span>
        <span class="ach-note">${escapeHtml(it.note)}</span>
      </li>`).join('')}</ul>
    </div>`).join('');

  return tally + '<div class="ach-list">' + body + '</div>';
}

/* ─── Kết quả các trận ở giải gần nhất ─────────────────────────────────── */
// Ưu tiên giải đang diễn ra (có tỷ số realtime), nếu VĐV chưa đấu trận nào
// thì lùi về giải đã kết thúc gần nhất có dữ liệu trận.
function latestResults(name){
  // 1) Giải đang diễn ra
  const live = [];
  ALL_FIXTURES.forEach(f => {
    if(f.p1 !== name && f.p2 !== name) return;
    const sc = scores[f.id];
    if(!sc || !sc.played) return;
    const isP1 = f.p1 === name;
    const own = isP1 ? sc.s1 : sc.s2;
    const opp = isP1 ? sc.s2 : sc.s1;
    live.push({
      mine: name,
      opponent: isP1 ? f.p2 : f.p1,
      own, opp,
      win: own > opp,
      event: f.group === 'nam' ? 'Đơn Nam' : 'Đơn Nữ'
    });
  });
  if(live.length) return { label: CURRENT_TOURNAMENT.badge, items: live.reverse() };

  // 2) Giải đã kết thúc gần nhất có kết quả của VĐV này
  for(const year of Object.keys(TOUR_DATA).sort((a, b) => b - a)){
    for(const t of (TOUR_DATA[year] || [])){
      const items = [];
      Object.keys(t.events || {}).forEach(key => {
        const ev = t.events[key];
        (ev.matches || []).forEach(m => {
          const inA = ev.teams[m.a].includes(name);
          const inB = ev.teams[m.b].includes(name);
          if(!inA && !inB) return;
          const own = inA ? m.sa : m.sb;
          const opp = inA ? m.sb : m.sa;
          items.push({
            mine: (inA ? ev.teams[m.a] : ev.teams[m.b]).join(' / '),
            opponent: (inA ? ev.teams[m.b] : ev.teams[m.a]).join(' / '),
            own, opp,
            win: own > opp,
            event: EVENT_VI[key] || key.toUpperCase()
          });
        });
      });
      if(items.length) return { label: t.badge || t.name, items: items.reverse() };
    }
  }
  return null;
}

function latestResultsHtml(name){
  const res = latestResults(name);
  if(!res) return '<p class="pm-none">Chưa có trận nào được ghi nhận</p>';
  const rows = res.items.slice(0, 8).map(r => `<li class="${r.win ? 'win' : 'loss'}">
      <span class="pm-res-tag">${r.win ? 'W' : 'L'}</span>
      <div class="pm-res-body">
        <div class="pm-res-side ${r.win ? 'winner' : ''}">
          <span class="side-name">${escapeHtml(r.mine)}</span>
          <span class="side-score">${r.own}</span>
        </div>
        <div class="pm-res-side ${r.win ? '' : 'winner'}">
          <span class="side-name">${escapeHtml(r.opponent)}</span>
          <span class="side-score">${r.opp}</span>
        </div>
        <span class="pm-res-event">${escapeHtml(r.event)}</span>
      </div>
    </li>`).join('');
  return `<p class="pm-res-label">${escapeHtml(res.label)}</p><ul class="pm-results">${rows}</ul>`;
}

/* ─── Hồ sơ đầy đủ của một VĐV ─────────────────────────────────────────── */
function openPlayerPage(name){
  const row = directoryRows().find(r => r.name === name);
  const page = document.getElementById('player-page');
  if(!row || !page) return;

  const info = row.info;
  const nm = splitName(row.name);
  const photo = info.photo
    ? `<img src="${escapeHtml(info.photo)}" alt="${escapeHtml(row.name)}">`
    : DEFAULT_AVATAR_SVG;
  const rankTxt = row.rank === undefined ? '—' : '#' + row.rank;
  const rankCls = row.rank >= 1 && row.rank <= 3 ? ' top-' + row.rank : '';

  page.innerHTML = `
    <div class="pp-hero">
      <div class="pp-photo">
        ${info.photo ? `<div class="pd-photo-bg" style="background-image:url('${escapeHtml(info.photo)}')"></div>` : ''}
        ${photo}
      </div>
      <div class="pp-id">
        ${nm.given ? `<span class="pp-given">${escapeHtml(nm.given)}</span>` : ''}
        <h2 class="pp-family">${escapeHtml(nm.family)}</h2>
        ${info.nickname ? `<span class="pp-nick">(${escapeHtml(info.nickname)})</span>` : ''}
        <div class="pp-loc">${flagHtml(info)}<span>${escapeHtml(locationText(info))}</span></div>
        <div class="pp-chips">
          <span class="pp-chip${rankCls}">RANK ${rankTxt}</span>
          <span class="pp-chip ghost">${row.points === undefined ? '—' : row.points + ' PTS'}</span>
          ${(row.tags || []).map(t => `<span class="pp-chip mvp mvp-${t.key}">${t.label}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="pp-tabs" id="pp-tabs">
      <button type="button" class="pp-tab active" data-tab="profile">Profile</button>
      <button type="button" class="pp-tab" data-tab="rating">
        <svg class="pp-tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        Rating
      </button>
      <button type="button" class="pp-tab" data-tab="confession">
        <svg class="pp-tab-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.5-.6L3 21l1.7-4.4A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"></path></svg>
        Confession
        <b class="pp-badge" id="cmt-badge" hidden>0</b>
      </button>
    </div>

    <div class="pp-panel active" id="pp-panel-profile">
      <div class="card">
        <h2>Profile</h2>
        <div class="pp-stats">
          <div class="pp-stat">
            <span class="lbl">Date of Birth</span>
            <span class="val">${escapeHtml(info.dob || '—')}</span>
          </div>
          <div class="pp-stat">
            <span class="lbl">Ranking Points</span>
            <span class="val accent">${row.points === undefined ? '—' : row.points}</span>
          </div>
          <div class="pp-stat">
            <span class="lbl">Hometown</span>
            <span class="val">${escapeHtml(info.hometown || '—')}</span>
          </div>
          <div class="pp-stat">
            <span class="lbl">Nation</span>
            <span class="val">${flagHtml(info)}${escapeHtml(info.nation || '—')}</span>
          </div>
          <div class="pp-stat pp-stat-wide">
            <span class="lbl">Nickname</span>
            <span class="val">${info.nickname ? escapeHtml(info.nickname) : '—'}</span>
          </div>
          <div class="pp-stat pp-stat-wide">
            <span class="lbl">Current Racket</span>
            <span class="val">${escapeHtml(info.racket || '—')}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Achievements</h2>
        ${achievementsHtml(row.name)}
      </div>

      <div class="card">
        <h2>Latest Results</h2>
        ${latestResultsHtml(row.name)}
      </div>
    </div>

    <div class="pp-panel" id="pp-panel-rating">
      <p class="rt-note rt-note-top">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        <span>Điểm đánh giá sẽ được làm mới vào đầu mỗi mùa giải mới.</span>
      </p>

      <div class="card">
        <h2>Rating Summary</h2>
        <div class="rt-summary">
          <div class="rt-overall">
            <span class="rt-overall-num" id="rt-overall-num">–</span>
            <span class="rt-overall-lbl">/ 10 average</span>
          </div>
          <div class="rt-count" id="rt-count">Chưa có lượt đánh giá nào</div>
        </div>
        <div class="rt-avg-grid" id="rt-bars"></div>
      </div>

      <div class="card" id="rt-form-card">
        <h2>Rate This Player</h2>
        <div class="rt-fields" id="rt-fields"></div>
        <button type="button" class="cmt-send" id="rt-submit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          Gửi đánh giá
        </button>
        <p class="cmt-error" id="rt-error"></p>
      </div>

      <div class="card" id="rt-done-card" style="display:none;">
        <div class="rt-done">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Bạn đã đánh giá vận động viên này trong mùa hiện tại</span>
        </div>
      </div>

    </div>

    <div class="pp-panel" id="pp-panel-confession">
      <div class="card">
        <h2>Write a Message</h2>
        <p class="cmt-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          <span>Ẩn danh hoàn toàn — Ai cũng có thể gửi và xem lời nhắn của VĐV này</span>
        </p>
        <div class="cmt-form">
          <input type="text" id="cmt-name" class="cmt-input" maxlength="40" placeholder="Tên của bạn">
          <textarea id="cmt-text" class="cmt-input cmt-area" maxlength="300" rows="3" placeholder="Viết lời nhắn..."></textarea>
          <div class="cmt-actions">
            <span class="cmt-count" id="cmt-count">0/300</span>
            <button type="button" class="cmt-send" id="cmt-send">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              Gửi lời nhắn (Ẩn danh)
            </button>
          </div>
          <p class="cmt-error" id="cmt-error"></p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2>All Messages</h2>
          <span class="cmt-total" id="cmt-total">0</span>
        </div>
        <div class="cmt-list" id="cmt-list"><p class="cmt-empty">Đang tải lời nhắn...</p></div>
      </div>
    </div>`;

  // Chuyển tab trong trang hồ sơ
  page.querySelectorAll('.pp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-tab');
      page.querySelectorAll('.pp-tab').forEach(b => b.classList.toggle('active', b === btn));
      page.querySelectorAll('.pp-panel').forEach(pn => {
        pn.classList.toggle('active', pn.id === 'pp-panel-' + key);
      });
      if(key === 'confession') markCommentsSeen();
      // Đổi tab con không tạo thêm lịch sử Back riêng — chỉ cập nhật URL tại chỗ
      setRoute('player/' + playerKey(row.name) + '/' + key, { replace: true });
    });
  });

  switchView('player', false);
  setRoute('player/' + playerKey(row.name));
  setHeader(['LMCL', 'PLAYER', 'PROFILE'], '');
  setupComments(row.name);
  setupRatings(row.name);
}

/* ─── Đánh giá vận động viên (Rating) ──────────────────────────────────── */
// Điểm gắn với mùa giải mới nhất (DEFAULT_TOUR_YEAR). Khi mùa mới bắt đầu và
// TOUR_DATA có thêm năm mới, đường dẫn lưu trên Firebase tự đổi theo — nghĩa
// là điểm cũ không mất nhưng không còn tính vào bảng hiện tại, và ai cũng
// đánh giá lại được từ đầu, đúng như ghi chú "làm mới mỗi mùa giải".
const RATING_SEASON = String(Object.keys(TOUR_DATA).sort((a, b) => b - a)[0]);

const RATING_CRITERIA = [
  { key: 'skill',     label: 'Trình độ' },
  { key: 'attitude',  label: 'Thái độ' },
  { key: 'fairplay',  label: 'Fair-play' },
  { key: 'teamwork',  label: 'Đồng đội' }
];

// Mỗi máy có một mã riêng lưu trong localStorage, dùng làm khoá trên Firebase
// để đảm bảo một máy chỉ gửi được một lượt đánh giá cho mỗi VĐV mỗi mùa.
function getDeviceId(){
  const STORE_KEY = 'lmcl_device_id';
  try {
    let id = localStorage.getItem(STORE_KEY);
    if(!id){
      id = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(STORE_KEY, id);
    }
    return id;
  } catch(e){
    // Trình duyệt chặn localStorage (chế độ riêng tư) → dùng mã tạm trong phiên
    if(!window.__lmclDeviceIdFallback){
      window.__lmclDeviceIdFallback = 'd_' + Math.random().toString(36).slice(2, 10);
    }
    return window.__lmclDeviceIdFallback;
  }
}

let activeRatingRef = null;

function detachRatings(){
  if(activeRatingRef){
    activeRatingRef.off();
    activeRatingRef = null;
  }
}

// Điểm trung bình riêng của từng mục, trình bày dạng lưới thẻ tách biệt
// thay vì gộp chung một thanh, để thấy rõ Trình độ khác Fair-play thế nào.
function ratingBarsHtml(entries){
  const n = entries.length;
  const avg = key => n === 0 ? 0 : entries.reduce((s, e) => s + (Number(e[key]) || 0), 0) / n;

  return RATING_CRITERIA.map(c => {
    const v = avg(c.key);
    return `<div class="rt-avg-card">
      <span class="rt-avg-label">${escapeHtml(c.label)}</span>
      <span class="rt-avg-val">${n === 0 ? '–' : v.toFixed(1)}</span>
    </div>`;
  }).join('');
}

// Lựa chọn hiện tại của người dùng cho mỗi mục — reset mỗi khi mở hồ sơ mới
let ratingSelections = {};

function buildRatingFields(){
  ratingSelections = {};
  const wrap = document.getElementById('rt-fields');
  if(!wrap) return;

  wrap.innerHTML = RATING_CRITERIA.map(c => `
    <div class="rt-field" data-key="${c.key}">
      <div class="rt-field-head">
        <span class="rt-field-label">${escapeHtml(c.label)}</span>
        <span class="rt-field-val" id="rt-val-${c.key}">–</span>
      </div>
      <div class="rt-numrow" id="rt-numrow-${c.key}">
        ${Array.from({length: 10}, (_, i) => i + 1)
          .map(n => `<button type="button" class="rt-num" data-val="${n}">${n}</button>`).join('')}
      </div>
    </div>
  `).join('');

  RATING_CRITERIA.forEach(c => {
    const row = document.getElementById('rt-numrow-' + c.key);
    const valEl = document.getElementById('rt-val-' + c.key);
    if(!row) return;
    row.querySelectorAll('.rt-num').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = Number(btn.getAttribute('data-val'));
        ratingSelections[c.key] = v;
        row.querySelectorAll('.rt-num').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if(valEl) valEl.textContent = v;
        const errEl = document.getElementById('rt-error');
        if(errEl) errEl.textContent = '';
      });
    });
  });
}

function setupRatings(playerName){
  detachRatings();

  const key = playerKey(playerName);
  const deviceId = getDeviceId();
  const ref = ratingsRef.child(RATING_SEASON).child(key);
  activeRatingRef = ref;

  const formCard = document.getElementById('rt-form-card');
  const doneCard = document.getElementById('rt-done-card');
  const errEl = document.getElementById('rt-error');
  const submitBtn = document.getElementById('rt-submit');

  buildRatingFields();
  if(errEl) errEl.textContent = '';

  ref.on('value', snap => {
    const val = snap.val() || {};
    const entries = Object.values(val);
    const n = entries.length;

    const countEl = document.getElementById('rt-count');
    const overallEl = document.getElementById('rt-overall-num');
    const barsEl = document.getElementById('rt-bars');
    if(countEl) countEl.textContent = n === 0 ? 'Chưa có lượt đánh giá nào' : n + ' lượt đánh giá';
    if(barsEl) barsEl.innerHTML = ratingBarsHtml(entries);
    if(overallEl){
      if(n === 0){
        overallEl.textContent = '–';
      } else {
        const allAvg = RATING_CRITERIA.reduce((s, c) =>
          s + entries.reduce((a, e) => a + (Number(e[c.key]) || 0), 0) / n, 0) / RATING_CRITERIA.length;
        overallEl.textContent = allAvg.toFixed(1);
      }
    }

    const already = Object.prototype.hasOwnProperty.call(val, deviceId);
    if(formCard) formCard.style.display = already ? 'none' : '';
    if(doneCard) doneCard.style.display = already ? '' : 'none';
  }, error => {
    const barsEl = document.getElementById('rt-bars');
    if(barsEl) barsEl.innerHTML = '<p class="cmt-empty">Không tải được dữ liệu (' + escapeHtml(error.message) + ')</p>';
  });

  if(submitBtn){
    submitBtn.onclick = () => {
      const missing = RATING_CRITERIA.filter(c => !(c.key in ratingSelections));
      if(missing.length > 0){
        if(errEl) errEl.textContent = 'Vui lòng chọn điểm cho: ' + missing.map(c => c.label).join(', ');
        return;
      }

      const payload = { ts: Date.now() };
      RATING_CRITERIA.forEach(c => { payload[c.key] = ratingSelections[c.key]; });

      submitBtn.disabled = true;
      ref.child(deviceId).set(payload)
        .catch(err => {
          if(errEl) errEl.textContent = 'Gửi thất bại: ' + err.message;
        })
        .finally(() => { submitBtn.disabled = false; });
    };
  }
}

/* ─── Lời nhắn công khai cho vận động viên ─────────────────────────────── */
// Khoá lưu trên Firebase: bỏ dấu tiếng Việt để tránh ký tự không hợp lệ
function playerKey(name){
  return name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let activeCommentRef = null;
let currentPlayerKey = null;
let latestCommentTs = 0;

// Ghi nhớ trên máy người xem: mốc thời gian lời nhắn mới nhất họ đã đọc.
// Nhờ vậy huy hiệu chỉ hiện số lời nhắn MỚI kể từ lần xem gần nhất.
const seenMemory = {};
function seenKey(key){ return 'lmcl_cmt_seen_' + key; }

function getSeenTs(key){
  try {
    const v = localStorage.getItem(seenKey(key));
    if(v !== null) return Number(v) || 0;
  } catch(e){ /* trình duyệt chặn localStorage */ }
  return seenMemory[key] || 0;
}

function setSeenTs(key, ts){
  seenMemory[key] = ts;
  try { localStorage.setItem(seenKey(key), String(ts)); } catch(e){}
}

// Đánh dấu đã đọc và tắt huy hiệu
function markCommentsSeen(){
  if(!currentPlayerKey) return;
  setSeenTs(currentPlayerKey, latestCommentTs);
  const badge = document.getElementById('cmt-badge');
  if(badge){
    badge.hidden = true;
    badge.classList.remove('pulse');
  }
}

function detachComments(){
  if(activeCommentRef){
    activeCommentRef.off();
    activeCommentRef = null;
  }
  currentPlayerKey = null;
  latestCommentTs = 0;
}

function formatCommentTime(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const two = n => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function setupComments(playerName){
  detachComments();

  const listEl = document.getElementById('cmt-list');
  const nameEl = document.getElementById('cmt-name');
  const textEl = document.getElementById('cmt-text');
  const sendEl = document.getElementById('cmt-send');
  const errEl = document.getElementById('cmt-error');
  const countEl = document.getElementById('cmt-count');
  if(!listEl || !sendEl) return;

  // Nhớ tên đã nhập lần trước cho tiện
  const savedName = sessionStorage.getItem('lmcl_cmt_name');
  if(savedName) nameEl.value = savedName;

  textEl.addEventListener('input', () => {
    countEl.textContent = textEl.value.length + '/300';
  });

  const key = playerKey(playerName);
  const ref = commentsRef.child(key);
  activeCommentRef = ref;
  currentPlayerKey = key;
  latestCommentTs = 0;

  ref.limitToLast(50).on('value', snap => {
    const val = snap.val() || {};
    const items = Object.keys(val)
      .map(k => ({ id: k, ...val[k] }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));

    const totalEl = document.getElementById('cmt-total');
    if(totalEl) totalEl.textContent = items.length;

    latestCommentTs = items.reduce((max, it) => Math.max(max, it.ts || 0), 0);
    const seenTs = getSeenTs(key);
    const unread = items.filter(it => (it.ts || 0) > seenTs).length;

    const panel = document.getElementById('pp-panel-confession');
    const badge = document.getElementById('cmt-badge');

    // Đang mở sẵn tab Confession thì coi như đã đọc luôn
    if(panel && panel.classList.contains('active')){
      markCommentsSeen();
    } else if(badge){
      if(unread > 0){
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.hidden = false;
        badge.classList.add('pulse');
      } else {
        badge.hidden = true;
        badge.classList.remove('pulse');
      }
    }

    if(items.length === 0){
      listEl.innerHTML = '<p class="cmt-empty">Chưa có lời nhắn nào. Hãy là người đầu tiên!</p>';
      return;
    }
    listEl.innerHTML = items.map(it => `<div class="cmt-item">
        <div class="cmt-head">
          <span class="cmt-who">${escapeHtml(it.name || 'Ẩn danh')}</span>
          <span class="cmt-time">${escapeHtml(formatCommentTime(it.ts))}</span>
        </div>
        <p class="cmt-body">${escapeHtml(it.text || '')}</p>
      </div>`).join('');
  }, error => {
    listEl.innerHTML = '<p class="cmt-empty">Không tải được lời nhắn (' + escapeHtml(error.message) + ')</p>';
  });

  sendEl.addEventListener('click', () => {
    const who = nameEl.value.trim();
    const msg = textEl.value.trim();
    errEl.textContent = '';

    if(!who){ errEl.textContent = 'Bạn hãy nhập tên'; nameEl.focus(); return; }
    if(!msg){ errEl.textContent = 'Lời nhắn đang trống'; textEl.focus(); return; }

    sendEl.disabled = true;
    ref.push({ name: who.slice(0, 40), text: msg.slice(0, 300), ts: Date.now() })
      .then(() => {
        sessionStorage.setItem('lmcl_cmt_name', who);
        textEl.value = '';
        countEl.textContent = '0/300';
      })
      .catch(err => { errEl.textContent = 'Gửi thất bại: ' + err.message; })
      .finally(() => { sendEl.disabled = false; });
  });
}

/* =========================================
   TOUR VIEW
   ========================================= */
const DEFAULT_TOUR_YEAR = Object.keys(TOUR_DATA).sort((a, b) => b - a)[0];
let currentTourYear = DEFAULT_TOUR_YEAR;

// Markup của một bảng xếp hạng đã chốt (điểm và thay đổi hạng lấy từ dữ liệu giải).
function staticRankingRowsHtml(standings){
  return standings.map((r, i) => {
    let changeCls = 'rank-same';
    let changeText = '–';
    if(r.change > 0){ changeCls = 'rank-up'; changeText = '▲ +' + r.change; }
    else if(r.change < 0){ changeCls = 'rank-down'; changeText = '▼ ' + r.change; }
    return `<tr data-change="${r.change || 0}">
      <td>${getRankBadgeHtml(i + 1)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td class="total-pts">${r.points}</td>
      <td class="rank-change ${changeCls}">${changeText}</td>
    </tr>`;
  }).join('');
}

// Diễn hoạt vị trí cũ → vị trí mới cho bảng xếp hạng tĩnh.
// change = hạng cũ − hạng mới, nên hàng bắt đầu lệch xuống/lên đúng số bậc đã đổi.
const STATIC_ROW_MS = 460;
const STATIC_STAGGER_MS = 55;

function animateStaticRanking(tbody){
  if(!tbody) return;
  const trs = Array.from(tbody.querySelectorAll('tr[data-change]'));
  if(trs.length === 0) return;
  if(REDUCE_MOTION) return;

  const rowHeight = trs[0].getBoundingClientRect().height || 34;

  trs.forEach((tr, i) => {
    const ch = parseInt(tr.getAttribute('data-change'), 10) || 0;
    tr.classList.remove('rk-up-glow', 'rk-down-glow');
    tr.style.transition = 'none';
    tr.style.transform = ch !== 0 ? `translateY(${ch * rowHeight}px)` : 'translateY(6px)';
    tr.style.opacity = '0';
    tr.style.zIndex = ch !== 0 ? '2' : '1';
  });

  void tbody.offsetHeight;

  requestAnimationFrame(() => {
    trs.forEach((tr, i) => {
      const delay = i * STATIC_STAGGER_MS;
      tr.style.transition =
        `transform ${STATIC_ROW_MS}ms cubic-bezier(0.34, 1.2, 0.4, 1) ${delay}ms, opacity 280ms ease ${delay}ms`;
      tr.style.transform = '';
      tr.style.opacity = '1';
    });
  });

  trs.forEach((tr, i) => {
    const ch = parseInt(tr.getAttribute('data-change'), 10) || 0;
    if(ch === 0) return;
    setTimeout(() => {
      tr.classList.add(ch > 0 ? 'rk-up-glow' : 'rk-down-glow');
    }, i * STATIC_STAGGER_MS + STATIC_ROW_MS - 120);
  });
}

// Danh sách các giải đã chốt bảng xếp hạng, mới nhất trước.
function finishedTournaments(){
  const out = [];
  Object.keys(TOUR_DATA).sort((a, b) => b - a).forEach(year => {
    (TOUR_DATA[year] || []).forEach(t => {
      if(t.status === 'finished' && t.standings) out.push(t);
    });
  });
  return out;
}

function findTournament(id){
  for(const year of Object.keys(TOUR_DATA)){
    const t = (TOUR_DATA[year] || []).find(x => x.id === id);
    if(t) return t;
  }
  return null;
}

// Bảng xếp hạng của một hạng mục đôi, tính từ chính các trận trong dữ liệu giải.
function computeEventStandings(ev){
  const rows = ev.teams.map((pair, i) => ({
    idx: i, pair, played: 0, win: 0, loss: 0, ptsFor: 0, ptsAgainst: 0
  }));
  ev.matches.forEach(m => {
    const A = rows[m.a], B = rows[m.b];
    if(!A || !B) return;
    A.played++; B.played++;
    A.ptsFor += m.sa; A.ptsAgainst += m.sb;
    B.ptsFor += m.sb; B.ptsAgainst += m.sa;
    if(m.sa > m.sb){ A.win++; B.loss++; } else { B.win++; A.loss++; }
  });
  return rows.map(r => ({ ...r, diff: r.ptsFor - r.ptsAgainst }))
    .sort((x, y) => (y.win - x.win) || (y.diff - x.diff) || (y.ptsFor - x.ptsFor));
}

function pairHtml(pair){
  return pair.map(n => escapeHtml(n)).join('<br>');
}

function eventContentHtml(ev){
  let fixturesHtml = '';
  if(ev.matches && ev.matches.length > 0){
    fixturesHtml = '<div class="fixtures">' + ev.matches.map((m, i) => {
      const t1 = ev.teams[m.a], t2 = ev.teams[m.b];
      const w1 = m.sa > m.sb ? 'winner' : '';
      const w2 = m.sb > m.sa ? 'winner' : '';
      return `<div class="fixture-row played ${ev.rowClass || ''}">
        <span class="fixture-num">${i + 1}</span>
        <span class="name pair right">${pairHtml(t1)}</span>
        <span class="score-display ${w1}">${m.sa}</span>
        <span></span>
        <span class="score-display ${w2}">${m.sb}</span>
        <span class="name pair">${pairHtml(t2)}</span>
      </div>`;
    }).join('') + '</div>';
  }

  // Hạng mục có finalRanking: chỉ hiển thị các đội được liệt kê.
  if(ev.finalRanking){
    // Tính thống kê từ các trận nếu cần hiển thị cột P/W/L/PF/PA/DIFF.
    const statsMap = {};
    if(ev.showFullStats){
      const allRows = computeEventStandings(ev);
      allRows.forEach(r => { statsMap[r.idx] = r; });
    }

    if(ev.showFullStats){
      const rows = ev.finalRanking.map(r => {
        const s = statsMap[r.t] || { played:0,win:0,loss:0,ptsFor:0,ptsAgainst:0,diff:0 };
        return `<tr>
          <td>${getRankBadgeHtml(r.rank)}</td>
          <td>${pairHtml(ev.teams[r.t])}</td>
          <td>${s.played}</td>
          <td>${s.win}</td>
          <td>${s.loss}</td>
          <td>${s.ptsFor}</td>
          <td>${s.ptsAgainst}</td>
          <td class="${s.diff > 0 ? 'diff-pos' : (s.diff < 0 ? 'diff-neg' : '')}">${s.diff > 0 ? '+' : ''}${s.diff}</td>
        </tr>`;
      }).join('');
      return `${fixturesHtml}
        <div class="table-scroll">
          <table class="standings standings-teams">
            <thead><tr><th>#</th><th>Đội</th><th>P</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    const simple = ev.finalRanking.map(r => `<tr>
      <td>${getRankBadgeHtml(r.rank)}</td>
      <td>${pairHtml(ev.teams[r.t])}</td>
      <td class="event-name">${escapeHtml(ev.title || '')}</td>
    </tr>`).join('');
    return `${fixturesHtml}
      <div class="table-scroll">
        <table class="standings standings-simple">
          <thead><tr><th>#</th><th>Đội</th><th>Nội dung</th></tr></thead>
          <tbody>${simple}</tbody>
        </table>
      </div>`;
  }

  const standings = computeEventStandings(ev).map((r, i) => `<tr>
    <td>${getRankBadgeHtml(i + 1)}</td>
    <td>${pairHtml(r.pair)}</td>
    <td>${r.played}</td>
    <td>${r.win}</td>
    <td>${r.loss}</td>
    <td>${r.ptsFor}</td>
    <td>${r.ptsAgainst}</td>
    <td class="${r.diff > 0 ? 'diff-pos' : (r.diff < 0 ? 'diff-neg' : '')}">${r.diff > 0 ? '+' : ''}${r.diff}</td>
  </tr>`).join('');

  return `${fixturesHtml}
    <div class="table-scroll">
      <table class="standings standings-teams">
        <thead><tr><th>#</th><th>Đội</th><th>P</th><th>W</th><th>L</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead>
        <tbody>${standings}</tbody>
      </table>
    </div>`;
}

function rankContentHtml(t){
  return `<div class="table-scroll">
      <table class="standings standings-overall">
        <thead><tr><th>#</th><th>Player</th><th>PTS</th><th>Change +/-</th></tr></thead>
        <tbody>${staticRankingRowsHtml(t.standings)}</tbody>
      </table>
    </div>`;
}

// ─── Tournament single-card navigation ─────────────────────────────────────
// State: which tournament is open and which event tab is active.
let currentTourId = null;

function allFinishedTournaments(){
  const out = [];
  Object.keys(TOUR_DATA).sort((a, b) => b - a).forEach(year => {
    (TOUR_DATA[year] || []).forEach(t => {
      if(t.status === 'finished') out.push({ year, t });
    });
  });
  return out;
}

function showTourListView(){
  currentTourId = null;
  const detail = document.getElementById('tour-detail-view');
  if(detail) detail.style.display = 'none';
  document.querySelectorAll('#tour-list .tour-card').forEach(c => c.classList.remove('active-tour'));
}

function showTourDetailView(t, tabKey){
  if(!t) return;
  currentTourId = t.id;

  document.getElementById('tour-detail-title').textContent = t.badge || t.name;

  // Nút chuyển nhanh sang giải đã kết thúc khác
  const finished = allFinishedTournaments();
  const idx = finished.findIndex(x => x.t.id === t.id);
  const navBtns = document.getElementById('tour-nav-btns');
  navBtns.innerHTML = `<div class="tour-switcher">
    <button class="tour-switch-btn" id="tour-prev-btn" aria-label="Giải trước" ${idx >= finished.length - 1 ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </button>
    <span class="tour-switch-label">${idx + 1}/${finished.length}</span>
    <button class="tour-switch-btn" id="tour-next-btn" aria-label="Giải sau" ${idx <= 0 ? 'disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
  </div>`;

  const prevBtn = document.getElementById('tour-prev-btn');
  const nextBtn = document.getElementById('tour-next-btn');
  if(prevBtn) prevBtn.addEventListener('click', () => switchToTournament(finished[idx + 1]));
  if(nextBtn) nextBtn.addEventListener('click', () => switchToTournament(finished[idx - 1]));

  // Tabs
  const eventKeys = t.events ? Object.keys(t.events) : [];
  const tabs = eventKeys.map(k => ({ key: k, label: t.events[k].label || k.toUpperCase() }));
  if(t.standings) tabs.push({ key: 'rank', label: 'Rankings' });

  const active = tabs.some(x => x.key === tabKey) ? tabKey : (tabs[0] ? tabs[0].key : 'rank');

  const tabsEl = document.getElementById('tour-detail-tabs');
  tabsEl.innerHTML = tabs.map(x =>
    `<button type="button" class="sub-tab-btn ${x.key === active ? 'active' : ''}" data-tab="${x.key}">${escapeHtml(x.label)}</button>`
  ).join('');
  tabsEl.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTourDetailView(t, btn.getAttribute('data-tab')));
  });

  const contentEl = document.getElementById('tour-detail-content');
  contentEl.innerHTML = active === 'rank' ? rankContentHtml(t) : eventContentHtml(t.events[active]);
  if(active === 'rank'){
    animateStaticRanking(contentEl.querySelector('tbody'));
  }

  document.getElementById('tour-detail-view').style.display = '';

  document.querySelectorAll('#tour-list .tour-card').forEach(c => {
    c.classList.toggle('active-tour', c.getAttribute('data-tour-id') === t.id);
  });

  if(t.titleLines) setHeader(t.titleLines, t.badge);
}

// Chuyển sang giải khác, tự đổi năm nếu giải đó thuộc mùa khác.
function switchToTournament(entry){
  if(!entry) return;
  if(String(entry.year) !== String(currentTourYear)) renderTourList(entry.year);
  showTourDetailView(entry.t);
  setRoute('tour/' + entry.year + '/' + entry.t.id);
}

// Keep old name for compatibility with other callers
function renderTournamentDetail(t, tabKey){ showTourDetailView(t, tabKey); }
function hideTournamentDetail(){ showTourListView(); }

function buildSeasonSelect(){
  const sel = document.getElementById('tour-season-select');
  if(!sel) return;
  const years = Object.keys(TOUR_DATA).sort((a, b) => b - a);
  sel.innerHTML = years.map(y => `<option value="${y}">Season ${y}</option>`).join('');
  sel.value = currentTourYear;
  sel.addEventListener('change', () => {
    renderTourList(sel.value);
    setHeader(['LMCL', 'TOURNAMENT'], 'Season ' + currentTourYear);
    setRoute('tour/' + currentTourYear);
    // Đồng bộ trạng thái năm đang chọn ở menu bên trái
    document.querySelectorAll('#nav-tour-submenu .drawer-year-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-year') === String(currentTourYear));
    });
  });
}

function renderTourList(year){
  showTourListView();
  currentTourYear = String(year);
  document.getElementById('tour-title').textContent = 'Tournament';
  const seasonSel = document.getElementById('tour-season-select');
  if(seasonSel && seasonSel.value !== currentTourYear) seasonSel.value = currentTourYear;
  const list = TOUR_DATA[currentTourYear] || [];
  const listEl = document.getElementById('tour-list');
  const subEl = document.getElementById('tour-sub');

  if(list.length === 0){
    subEl.textContent = 'Chưa có giải đấu nào trong Season ' + currentTourYear + '.';
    listEl.innerHTML = '<div class="tour-empty">Chưa có dữ liệu giải đấu</div>';
    return;
  }
  subEl.textContent = '';

  listEl.innerHTML = list.map(t => {
    const isLive = t.status === 'live';
    return `<div class="tour-card ${isLive ? 'live-badge' : 'finished-card'}" data-tour-id="${escapeHtml(t.id)}" data-status="${escapeHtml(t.status)}">
      <div>
        <h3>${escapeHtml(t.badge || t.name)}</h3>
        ${isLive ? '<p>Đang diễn ra</p>' : ''}
      </div>
      <span class="tour-arrow">›</span>
    </div>`;
  }).join('');

  listEl.querySelectorAll('.tour-card').forEach(card => {
    card.addEventListener('click', () => {
      if(card.getAttribute('data-status') === 'live'){
        switchView('livematch');
        closeDrawer();
        return;
      }
      const id = card.getAttribute('data-tour-id');
      const t = findTournament(id);
      if(t){
        showTourDetailView(t);
        setRoute('tour/' + currentTourYear + '/' + id);
      }
    });
  });

  // Mùa chỉ có đúng một giải đã kết thúc thì mở luôn bảng, khỏi phải bấm thêm
  if(list.length === 1 && list[0].status === 'finished'){
    showTourDetailView(list[0]);
  }
}

function renderTourSubmenu(){
  const years = Object.keys(TOUR_DATA).sort((a,b) => b - a);
  const submenu = document.getElementById('nav-tour-submenu');
  submenu.innerHTML = years.map(y => `
    <button type="button" class="drawer-year-btn" data-year="${y}">Season ${y}</button>
    <div class="drawer-year-list" data-year-list="${y}">
      ${(TOUR_DATA[y] || []).map(t => `<button type="button" class="drawer-tour-item" data-tour-id="${escapeHtml(t.id)}" data-year="${y}" data-status="${escapeHtml(t.status)}">${escapeHtml(t.name)}</button>`).join('') || '<div class="drawer-tour-item" style="cursor:default;color:var(--chalk-dim);opacity:0.6;">Chưa có giải đấu</div>'}
    </div>
  `).join('');

  submenu.querySelectorAll('.drawer-year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      submenu.querySelectorAll('.drawer-year-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const year = btn.getAttribute('data-year');
      renderTourList(year);
      switchView('tour', false);
      setRoute('tour/' + year);
      closeDrawer();
    });
  });
  submenu.querySelectorAll('.drawer-tour-item[data-tour-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const year = btn.getAttribute('data-year');
      const id = btn.getAttribute('data-tour-id');
      renderTourList(year);
      if(btn.getAttribute('data-status') === 'live'){
        hideTournamentDetail();
        switchView('livematch');
      } else {
        switchView('tour', false);
        renderTourList(year);
        const t = (TOUR_DATA[year] || []).find(x => x.id === id);
        if(t) showTourDetailView(t);
        setRoute('tour/' + year + '/' + id);
      }
      closeDrawer();
    });
  });
}

/* =========================================
   VIEW SWITCHING + DRAWER
   ========================================= */
// Logo là nhận diện của đội và luôn cố định. Phần chữ bên cạnh logo là tên
// của giải/mục đang xem, nên được đổi theo từng view.
// Tên hiển thị trên tab trình duyệt — sửa một dòng này là đổi được toàn bộ
const APP_NAME = 'LMCL CLUB';

function setHeader(lines, badge){
  const el = document.getElementById('header-title');
  if(!el) return;
  el.innerHTML = lines.map(l => escapeHtml(l)).join('<br>') +
    (badge ? '<br><span class="badge-date">' + escapeHtml(badge) + '</span>' : '');
  // Tab luôn giữ một tên cố định, không đổi theo từng mục
  document.title = APP_NAME;
}

let rankingsSelection = 'live';

function buildRankingsSelect(){
  const sel = document.getElementById('rankings-select');
  if(!sel) return;
  const opts = ['<option value="live">' + escapeHtml(CURRENT_TOURNAMENT.badge) + ' (đang diễn ra)</option>']
    .concat(finishedTournaments().map(t =>
      `<option value="${escapeHtml(t.id)}">${escapeHtml(t.badge || t.name)}</option>`));
  sel.innerHTML = opts.join('');
  sel.value = rankingsSelection;
  sel.addEventListener('change', () => {
    rankingsSelection = sel.value;
    renderRankingsView();
  });
}

function renderRankingsView(){
  const sub = document.getElementById('rankings-sub');
  const sel = document.getElementById('rankings-select');
  if(sel) sel.value = rankingsSelection;

  if(rankingsSelection === 'live'){
    if(sub){
      sub.textContent = 'Bảng xếp hạng tích luỹ, cập nhật trực tiếp theo kết quả của '
        + CURRENT_TOURNAMENT.name + '.';
    }
    paintTable('rankings', getRowsFor('rankings'), { forceEntrance: true });
    return;
  }

  const t = findTournament(rankingsSelection);
  const body = document.getElementById('standings-rankings');
  if(!t || !body) return;
  if(sub) sub.textContent = 'Bảng xếp hạng chung cuộc — ' + t.name + '.';
  body.innerHTML = staticRankingRowsHtml(t.standings);
  animateStaticRanking(body);
  paintedStandings.rankings = null;
}

// Màu chủ đề theo tab con của Current Season (MS/WS/Rankings/All Matches)
function themeForGroup(grp){
  if(grp === 'nam') return 'men';
  if(grp === 'nu') return 'women';
  if(grp === 'overall') return 'rankings';
  return 'allmatches';
}

// routeHash: bỏ trống thì tự đẩy đúng tên view lên URL (đủ dùng cho livematch/
// members/rankings). Truyền chuỗi riêng cho các view cần thêm định danh (tour
// cần năm/giải, player cần tên VĐV). Truyền false để tự xử lý routing bên ngoài.
function switchView(view, routeHash){
  const cameFromOtherView = currentView !== view;
  if(currentView === 'player' && view !== 'player'){
    if(typeof detachComments === 'function') detachComments();
    if(typeof detachRatings === 'function') detachRatings();
  }
  currentView = view;
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if(target) target.classList.add('active');

  // Trang hồ sơ VĐV có nút quay lại riêng nên không cần header logo phía trên nữa
  document.body.classList.toggle('hide-header', view === 'player');

  // Chỉ Current Season mới giữ màu theo tab con (MS xanh dương/WS hồng/Rankings vàng).
  // Mọi mục khác luôn về màu mặc định, tránh còn sót màu từ lần xem Current Season trước đó.
  document.body.setAttribute('data-theme', view === 'livematch' ? themeForGroup(activeGroupTab) : 'allmatches');

  if(routeHash !== false) setRoute(routeHash || view);

  // Rời khỏi Tournament thì thu gọn ngay danh sách mùa, tránh menu bị giật khi đóng
  if(view !== 'tour'){
    const sub = document.getElementById('nav-tour-submenu');
    const toggle = document.getElementById('nav-tour-toggle');
    if(sub) sub.classList.remove('open');
    if(toggle) toggle.classList.remove('expanded');
    document.querySelectorAll('#nav-tour-submenu .drawer-year-btn, #nav-tour-submenu .drawer-tour-item')
      .forEach(b => b.classList.remove('active'));
  }

  if(view === 'livematch'){
    setHeader(CURRENT_TOURNAMENT.titleLines, CURRENT_TOURNAMENT.badge);
  } else if(view === 'members'){
    setHeader(['LMCL', 'TEAM', 'MEMBERS'], '');
  } else if(view === 'player'){
    setHeader(['LMCL', 'PLAYER', 'PROFILE'], '');
  } else if(view === 'rankings'){
    setHeader(['LMCL', 'RANKINGS'], '');
  } else if(view === 'tour'){
    setHeader(['LMCL', 'TOURNAMENT'], 'Season ' + currentTourYear);
  }

  document.querySelectorAll('.drawer-item[data-view]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === view);
  });

  if(view === 'members'){
    renderMembers();
  }
  if(view === 'rankings'){
    renderRankingsView();
  }
  if(view === 'tour'){
    // Vào lại Tournament từ mục khác thì trả về trạng thái mặc định: mùa mới nhất
    if(cameFromOtherView) currentTourYear = DEFAULT_TOUR_YEAR;
    renderTourList(currentTourYear);
  }

  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  });
}

const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerOpenBtn = document.getElementById('drawer-open-btn');
const drawerCloseBtn = document.getElementById('drawer-close-btn');

// Đồng bộ trạng thái menu với những gì đang xem, chạy mỗi lần mở drawer.
function syncDrawerState(){
  const submenu = document.getElementById('nav-tour-submenu');
  const toggle = document.getElementById('nav-tour-toggle');
  if(!submenu || !toggle) return;

  // Đang ở trang Tournament thì mở sẵn danh sách mùa để thấy mục đang xem
  const onTour = currentView === 'tour';
  submenu.classList.toggle('open', onTour);
  toggle.classList.toggle('expanded', onTour);

  submenu.querySelectorAll('.drawer-year-btn').forEach(b => {
    b.classList.toggle('active', onTour && b.getAttribute('data-year') === String(currentTourYear));
  });
  submenu.querySelectorAll('.drawer-tour-item[data-tour-id]').forEach(b => {
    b.classList.toggle('active', onTour && b.getAttribute('data-tour-id') === currentTourId);
  });
}

function openDrawer(){
  syncDrawerState();
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
}
function closeDrawer(){
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

drawerOpenBtn.addEventListener('click', openDrawer);
drawerCloseBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

document.getElementById('nav-livematch').addEventListener('click', () => {
  switchView('livematch');
  closeDrawer();
});
const rankInfoModal = document.getElementById('rank-info-modal');
const rankInfoBtn = document.getElementById('rank-info-btn');
const rankInfoClose = document.getElementById('rank-info-close');
if(rankInfoBtn) rankInfoBtn.addEventListener('click', () => rankInfoModal.classList.add('open'));
if(rankInfoClose) rankInfoClose.addEventListener('click', () => rankInfoModal.classList.remove('open'));
if(rankInfoModal) rankInfoModal.addEventListener('click', e => {
  if(e.target === rankInfoModal) rankInfoModal.classList.remove('open');
});

const ppBack = document.getElementById('pp-back');
if(ppBack) ppBack.addEventListener('click', () => switchView('members'));

document.getElementById('nav-rankings').addEventListener('click', () => {
  switchView('rankings');
  closeDrawer();
});
document.getElementById('nav-members').addEventListener('click', () => {
  switchView('members');
  closeDrawer();
});

const navTourToggle = document.getElementById('nav-tour-toggle');
const navTourSubmenu = document.getElementById('nav-tour-submenu');
navTourToggle.addEventListener('click', () => {
  const isOpen = navTourSubmenu.classList.toggle('open');
  navTourToggle.classList.toggle('expanded', isOpen);
  // Bấm vào Tournament vừa mở danh sách năm, vừa chuyển sang trang Tournament
  // để mục này sáng lên như Current Season / Members. Drawer vẫn mở để chọn năm tiếp.
  switchView('tour', 'tour/' + currentTourYear);
  // Đánh dấu ngay mùa đang xem để thấy rõ mình đang ở đâu
  navTourSubmenu.querySelectorAll('.drawer-year-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-year') === String(currentTourYear));
  });
});

document.getElementById('nav-login').addEventListener('click', () => {
  closeDrawer();
  authToggleBtn.click();
});

renderTourSubmenu();
buildSeasonSelect();
buildRankingsSelect();

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const grp = btn.getAttribute('data-group');
    if(grp === activeGroupTab) return; 

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.group').forEach(g => g.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('group-' + grp).classList.add('active');
    
    document.body.setAttribute('data-theme', themeForGroup(grp));

    activeGroupTab = grp;

    if(grp === 'nam' || grp === 'nu' || grp === 'overall'){
      openStandingsTab(grp);
    }
    if(grp === 'nam' || grp === 'nu'){
      renderReadonlyGroup(grp);
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
  });
});

// Áp dụng công tắc mùa giải: 'idle' thì ẩn bảng chấm điểm, hiện màn hình chờ.
// Khi 'live' (mặc định) hàm này không đụng gì tới luồng hiện tại.
// Nút tắt dải nhắc chốt sổ (chỉ tắt trong phiên hiện tại)
(function(){
  const btn = document.getElementById('done-banner-close');
  if(btn) btn.addEventListener('click', () => {
    doneBannerDismissed = true;
    const el = document.getElementById('season-done-banner');
    if(el) el.style.display = 'none';
  });
})();

(function applySeasonStatus(){
  if(SEASON_STATUS !== 'idle') return;

  const live = document.getElementById('season-live');
  const idle = document.getElementById('season-idle');
  if(live) live.style.display = 'none';
  if(idle) idle.style.display = '';

  // Giữa hai mùa thì không còn giải nào để chấm điểm, ẩn luôn nút quyền BTC
  const authBtn = document.getElementById('auth-toggle-btn');
  if(authBtn) authBtn.style.display = 'none';

  const cta = document.getElementById('idle-to-tour');
  if(cta) cta.addEventListener('click', () => {
    renderTourList(DEFAULT_TOUR_YEAR);
    switchView('tour', 'tour/' + DEFAULT_TOUR_YEAR);
  });
})();

setHeader(CURRENT_TOURNAMENT.titleLines, CURRENT_TOURNAMENT.badge);
updateAuthUI();
renderAll();
renderReadonlyGroup('nam');
renderReadonlyGroup('nu');
openStandingsTab('nam');
