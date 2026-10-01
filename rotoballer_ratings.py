"""Parse explicit RotoBaller chart columns; never infer advice from colors."""
import csv
import io
import math
import re
import unicodedata
from datetime import date, timedelta
from html.parser import HTMLParser
from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit


def name_key(value):
    value = unicodedata.normalize('NFD', value).lower()
    return re.sub(r'[^a-z0-9]', '', ''.join(c for c in value if not unicodedata.combining(c)))


def team_key(value):
    value = value.strip().upper()
    return {'AZ': 'ARI', 'CWS': 'CHW', 'KC': 'KCR', 'SD': 'SDP', 'SF': 'SFG',
            'TB': 'TBR', 'WSH': 'WSN', 'WAS': 'WSN', 'OAK': 'ATH'}.get(value, value)


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tables, self.rows, self.row, self.cell = [], None, None, None

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.rows = []
        elif tag == 'tr' and self.rows is not None:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []
        elif tag == 'br' and self.cell is not None:
            self.cell.append(' ')

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            self.rows.append(self.row)
            self.row = None
        elif tag == 'table' and self.rows is not None:
            self.tables.append(self.rows)
            self.rows = None


def sheet_csv_url(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.hostname != 'docs.google.com':
        return None
    if not re.fullmatch(r'/spreadsheets/d/e/[\w-]+/pubhtml', parts.path):
        return None
    gid = parse_qs(parts.query).get('gid', [])
    if len(gid) != 1 or not gid[0].isdigit():
        return None
    return urlunsplit(('https', 'docs.google.com', parts.path[:-7] + 'pub',
                       urlencode({'gid': gid[0], 'single': 'true', 'output': 'csv'}), ''))


def header(value):
    return re.sub(r'[^a-z0-9/]', '', value.lower())


def number(value, maximum=None):
    try:
        n = float(value)
        return n if math.isfinite(n) and n >= 0 and (maximum is None or n <= maximum) else None
    except (TypeError, ValueError):
        return None


def advice(value):
    value = ' '.join(value.upper().split())
    return value if value in {'START', 'SIT', 'LEAN START', 'LEAN SIT', 'COIN FLIP', 'RISKY START'} else None


def chart_date(value, start, end):
    value = value.strip()
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            result = date.fromisoformat(value)
        else:
            m = re.fullmatch(r'(\d{1,2})/(\d{1,2})(?:/(\d{4}))?', value)
            if not m:
                return None
            month, day, year = m.groups()
            result = date(int(year or start.year), int(month), int(day))
        return result.isoformat() if start <= result <= end else None
    except ValueError:
        return None


def parse_ratings(source, kind, week_start, week_end):
    start, end = date.fromisoformat(week_start), date.fromisoformat(week_end)
    if '<table' in source.lower():
        parser = Tables()
        parser.feed(source)
        tables = parser.tables
    else:
        tables = [list(csv.reader(io.StringIO(source)))]
    output = []
    for table in tables:
        columns = None
        for row in table:
            heads = [header(c) for c in row]
            player_headers = ('pitcher', 'player', 'playername') if kind == 'pitchers' else ('hitter', 'player', 'playername')
            player_col = next((i for i, h in enumerate(heads) if h in player_headers), None)
            if player_col is not None and 'team' in heads:
                columns = {h: i for i, h in enumerate(heads)}
                columns['name'] = player_col
                continue
            if columns is None or not any(row):
                continue
            def get(key):
                i = columns.get(key)
                return row[i].strip() if i is not None and i < len(row) else ''
            name, team = get('name'), team_key(get('team'))
            if not name_key(name) or not re.fullmatch('[A-Z]{2,3}', team):
                continue
            item = {'player': name, 'player_key': name_key(name), 'team': team,
                    'recommendation': advice(get('start/sit'))}
            if kind == 'pitchers':
                day = chart_date(get('date'), start, end)
                game = re.fullmatch(r'([A-Z]{2,3})\s*@\s*([A-Z]{2,3})', get('game'))
                score = number(get('grade') or get('rating') or get('score'), 100)
                if not day or not game:
                    continue
                away, home = map(team_key, game.groups())
                if team not in (away, home) or away == home:
                    continue
                item.update(date=day, opponent=home if team == away else away,
                            home_away='away' if team == away else 'home', rating=score)
            else:
                dated = [(h, chart_date(h.removesuffix('score'), start, end))
                         for h in columns if re.fullmatch(r'\d{1,2}/\d{1,2}(?:/\d{4})?score', h)]
                expected = {(start + timedelta(days=i)).isoformat() for i in range((end-start).days+1)}
                # A reusable sheet must independently advertise exactly this week.
                if {d for _, d in dated} != expected or len(dated) != len(expected):
                    continue
                item.update(rating=number(get('weeklyscore')),
                            daily_ratings={d: number(get(h)) for h, d in dated})
            if item['recommendation'] is None and item['rating'] is None:
                continue
            output.append(item)
    return merge_ratings(output)


def merge_ratings(rows):
    unique, conflicts = {}, set()
    for item in rows:
        key = (item['player_key'], item['team'], item.get('date'))
        if item.get('status') == 'ambiguous':
            conflicts.add(key)
        if key in unique and unique[key] != item:
            conflicts.add(key)
        else:
            unique[key] = item
    return [dict(item, status='ambiguous', recommendation=None, rating=None, daily_ratings={})
            if key in conflicts else dict(item, status='verified') for key, item in unique.items()]
