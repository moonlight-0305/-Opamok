const SIZE = 15;
        let board = Array(SIZE).fill().map(() => Array(SIZE).fill(0));
        let gameOver = false;
        let isAiThinking = false;
        let moveHistory = [];

        
        const SCORES = {
            WIN: 10000000,
            LIVE_4: 1000000,
            BLOCKED_4: 100000,
            LIVE_3: 80000,
            BLOCKED_3: 10000,
            LIVE_2: 2000,
            BLOCKED_2: 500
        };

        const boardEl = document.getElementById('board');
        const statusEl = document.getElementById('status');
        const progressBar = document.getElementById('progress-bar');
        const progressContainer = document.getElementById('progress-container');

        function createBoard() {
            boardEl.innerHTML = '';
            const stars = ["3-3", "3-11", "7-7", "11-3", "11-11"];
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'cell';
                    if (stars.includes(`${r}-${c}`)) cell.classList.add('star');
                    cell.onclick = () => playerMove(r, c);
                    boardEl.appendChild(cell);
                }
            }
        }

        async function initGame() {
            createBoard();
            await new Promise(r => setTimeout(r, 600));
            aiMove(7, 7);
            statusEl.innerText = "분석 완료. 당신의 차례 (백)";
        }

        function playerMove(r, c) {
            if (gameOver || isAiThinking || board[r][c] !== 0) return;
            makeMove(r, c, 2); 
            if (checkWin(r, c, 2)) return endGame("인간 승리: 수학적 변수 발생");
            runAiTurn();
        }

        async function runAiTurn() {
            isAiThinking = true;
            statusEl.innerHTML = `<span class="text-amber-400">수학적 확률 분석 및 빌드 최적화 중...</span>`;
            progressContainer.classList.remove('invisible');
            
            const startTime = Date.now();
            let targetThinkTime = 1000;

           
            const isDanger = checkImmediateDanger();
            if (isDanger) targetThinkTime = 1500; 

            let timer = setInterval(() => {
                let elapsed = Date.now() - startTime;
                progressBar.style.width = Math.min((elapsed / targetThinkTime) * 100, 95) + '%';
            }, 50);

            
            const best = await getBestMoveAsync(isDanger);

            clearInterval(timer);
            progressBar.style.width = '100%';
            
            setTimeout(() => {
                if (best) {
                    aiMove(best.r, best.c);
                    if (checkWin(best.r, best.c, 1)) {
                        endGame("AI 승리: 완벽한 수순 계산");
                    } else {
                        statusEl.innerText = "분석 완료. 당신의 차례 (백)";
                    }
                }
                progressContainer.classList.add('invisible');
                progressBar.style.width = '0%';
                isAiThinking = false;
            }, 100);
        }

        function makeMove(r, c, p) {
            board[r][c] = p;
            moveHistory.push({r, c, p});
            renderStone(r, c, p);
        }

        function aiMove(r, c) {
            makeMove(r, c, 1);
        }

        function renderStone(r, c, p) {
            const cell = boardEl.children[r * SIZE + c];
            const stone = document.createElement('div');
            stone.className = `stone ${p === 1 ? 'black-stone' : 'white-stone'}`;
            
            document.querySelectorAll('.last-move-marker').forEach(el => el.remove());
            const marker = document.createElement('div');
            marker.className = 'last-move-marker';
            
            cell.appendChild(stone);
            cell.appendChild(marker);
        }

        

        async function getBestMoveAsync(isDanger) {
            let candidates = [];
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    if (board[r][c] === 0 && hasNeighbor(r, c)) {
                        const myScore = evaluatePoint(r, c, 1);
                        const opScore = evaluatePoint(r, c, 2);

                        if (myScore >= SCORES.WIN) return {r, c}; 
                        if (opScore >= SCORES.WIN) { 
                            candidates.push({r, c, score: SCORES.WIN + 100});
                            continue;
                        }

                        
                        const defenseWeight = isDanger ? 2.5 : 1.3;
                        const score = (myScore * 1.0) + (opScore * defenseWeight);
                        candidates.push({r, c, score});
                    }
                }
            }

            candidates.sort((a, b) => b.score - a.score);
            
            // 상위 5개 수에 대해 1단계 더 미래 예측 (간이 시뮬레이션)
            let best = candidates[0];
            let topTier = candidates.slice(0, 5);
            
            for (let i = 0; i < topTier.length; i++) {
                const m = topTier[i];
                board[m.r][m.c] = 1;
                m.score += (evaluateBoard() * 0.1);
                board[m.r][m.c] = 0;
                
                if (i % 2 === 0) await new Promise(r => requestAnimationFrame(r)); // 렉 방지
            }

            topTier.sort((a, b) => b.score - a.score);
            return topTier[0];
        }

        function checkImmediateDanger() {
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    if (board[r][c] === 0 && evaluatePoint(r, c, 2) >= SCORES.LIVE_3) return true;
                }
            }
            return false;
        }

        function evaluateBoard() {
            let total = 0;
            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    if (board[r][c] !== 0) {
                        const p = board[r][c];
                        total += (p === 1 ? evaluatePoint(r, c, 1) : -evaluatePoint(r, c, 2) * 1.5);
                    }
                }
            }
            return total;
        }

        function evaluatePoint(r, c, p) {
            let total = 0;
            const dirs = [[1,0], [0,1], [1,1], [1,-1]];
            for (let [dr, dc] of dirs) {
                const {count, open} = getPattern(r, c, dr, dc, p);
                if (count >= 5) total += SCORES.WIN;
                else if (count === 4) total += (open === 2 ? SCORES.LIVE_4 : (open === 1 ? SCORES.BLOCKED_4 : 0));
                else if (count === 3) total += (open === 2 ? SCORES.LIVE_3 : (open === 1 ? SCORES.BLOCKED_3 : 0));
                else if (count === 2) total += (open === 2 ? SCORES.LIVE_2 : 0);
            }
            return total;
        }

        function getPattern(r, c, dr, dc, p) {
            let count = 1;
            let open = 0;
            let step = 1;
            while (isValid(r+dr*step, c+dc*step) && board[r+dr*step][c+dc*step] === p) { count++; step++; }
            if (isValid(r+dr*step, c+dc*step) && board[r+dr*step][c+dc*step] === 0) open++;
            step = 1;
            while (isValid(r-dr*step, c-dc*step) && board[r-dr*step][c-dc*step] === p) { count++; step++; }
            if (isValid(r-dr*step, c-dc*step) && board[r-dr*step][c-dc*step] === 0) open++;
            return {count, open};
        }

        function hasNeighbor(r, c) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (isValid(r+i, c+j) && board[r+i][c+j] !== 0) return true;
                }
            }
            return false;
        }

        function checkWin(r, c, p) {
            const dirs = [[1,0],[0,1],[1,1],[1,-1]];
            for (let [dr, dc] of dirs) {
                let cnt = 1;
                for(let i=1; i<5; i++) if(isValid(r+dr*i, c+dc*i) && board[r+dr*i][c+dc*i]===p) cnt++; else break;
                for(let i=1; i<5; i++) if(isValid(r-dr*i, c-dc*i) && board[r-dr*i][c-dc*i]===p) cnt++; else break;
                if(cnt >= 5) return true;
            }
            return false;
        }

        function isValid(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

        function endGame(msg) {
            gameOver = true;
            statusEl.innerHTML = `<span class="text-red-500 font-bold">${msg}</span>`;
        }

        function resetGame() {
            board = Array(SIZE).fill().map(() => Array(SIZE).fill(0));
            gameOver = false;
            moveHistory = [];
            statusEl.innerText = "엔진 초기화 완료";
            createBoard();
            initGame();
        }

        function undoMove() {
            if (moveHistory.length < 2 || isAiThinking || gameOver) return;
            for(let i=0; i<2; i++) {
                const m = moveHistory.pop();
                board[m.r][m.c] = 0;
            }
            createBoard();
            moveHistory.forEach(m => renderStone(m.r, m.c, m.p));
            statusEl.innerText = "시간을 되돌렸습니다.";
            gameOver = false;
        }

        window.onload = initGame;
