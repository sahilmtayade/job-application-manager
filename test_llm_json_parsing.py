import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath('/home/sahil/workspace/job-application-manager'))

from jam.core.services.llm_service import LLMService

def test_json_extraction():
    service = LLMService()

    # Test 1: Markdown code block
    resp1 = "```json\n{\"company_name\": \"Test Co\", \"url\": null, \"notes\": \"remote position\"}\n```"
    d1 = service._parse_extraction_response(resp1)
    assert d1.company_name == "Test Co"

    # Test 2: Thinking tags + markdown
    resp2 = "<think>I need to parse this</think>\n```json\n{\"company_name\": \"Acme\", \"url\": null, \"notes\": \"remote position\"}\n```"
    d2 = service._parse_extraction_response(resp2)
    assert d2.company_name == "Acme"

    # Test 3: Nested JSON with text before and after
    resp3 = "Here is the result:\n{\n  \"company_name\": \"Nested Co\",\n  \"skills\": {\"matched\": [\"python\"]},\n  \"notes\": \"remote position\"\n}\nHope this helps."
    d3 = service._parse_extraction_response(resp3)
    assert d3.company_name == "Nested Co"

    print("ALL TESTS PASSED")

if __name__ == "__main__":
    test_json_extraction()
