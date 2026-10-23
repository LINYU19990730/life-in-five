"""Reproduce topic-title matches and catalogue-only transitions for ten periods."""
import re


def compile_order_data(topics, headings, sources):
    assert len({t['id'] for t in topics}) == len(topics), 'Duplicate order topic id'
    assert len({t['name'] for t in topics}) == len(topics), 'Duplicate order topic name'
    rows, periods = [], []
    for topic in topics:
        includes = [re.compile(s) for s in topic['include']]
        excludes = [re.compile(s) for s in topic.get('exclude', [])]
        assert includes and topic['description'], topic['id']
        matched = []
        for h in headings:
            title = re.sub(r'\s+', '', h['title'])
            if any(p.search(title) for p in includes) and not any(p.search(title) for p in excludes):
                matched.append(h)
                rows.append({'topic_id':topic['id'], 'topic':topic['name'], 'plan':h['plan'],
                             'plan_id':h['plan_id'], 'level':h['level'], 'rank':h['number'],
                             'total':h['level_total'], 'relative_position':h['relative_position'],
                             'title':h['title'], 'parent':h['parent'], 'page':h['page'],
                             'source_url':h['source_url']})
        assert matched, f"No matching heading: {topic['name']}"
        seen = False
        previous = []
        for index, source in enumerate(sources):
            hits = [h for h in matched if h['plan_id'] == source['id']]
            if hits:
                event = ('first_observed' if not seen else 'resumed') if not previous else 'continued'
                if previous and {h['level'] for h in previous} != {h['level'] for h in hits}:
                    event = 'level_changed'
            else:
                event = 'not_repeated' if previous else 'unmatched'
            periods.append({'topic_id':topic['id'], 'plan_id':source['id'],
                            'matched':bool(hits), 'heading_count':len(hits),
                            'levels':list(dict.fromkeys(h['level'] for h in hits)),
                            'event':event, 'is_scope_start':index==0})
            seen = seen or bool(hits)
            previous = hits
    return rows, periods
